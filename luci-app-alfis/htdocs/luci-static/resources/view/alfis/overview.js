'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require fs';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('alfis'), {}).then(function(res) {
		var isRunning = false;
		try {
			console.log('Service list response:', res);
			// Check if alfis service exists and has running instances
			if (res && res['alfis'] && res['alfis']['instances']) {
				// Try to find any running instance
				for (var instance in res['alfis']['instances']) {
					console.log('Checking instance:', instance, res['alfis']['instances'][instance]);
					if (res['alfis']['instances'][instance]['running']) {
						isRunning = true;
						break;
					}
				}
			}
		} catch(e) {
			console.log('Error checking alfis service status:', e);
		}
		console.log('Final running status:', isRunning);
		return isRunning;
	}).catch(function(err) {
		console.log('Service status call failed:', err);
		// If service status call fails, try alternative method
		return fs.exec('/etc/init.d/alfis', ['status']).then(function(result) {
			// If exit code is 0, service is running
			return result.code === 0;
		}).catch(function() {
			// If both fail, assume not running
			return false;
		});
	});
}

function parseTomlConfig(content) {
	var config = {};
	
	if (!content) return config;
	
	var lines = content.split('\n');
	var currentSection = '';
	
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		
		// Skip comments and empty lines
		if (!line || line.startsWith('#')) continue;
		
		// Handle sections
		if (line.startsWith('[') && line.endsWith(']')) {
			currentSection = line.slice(1, -1);
			if (!config[currentSection]) {
				config[currentSection] = {};
			}
			continue;
		}
		
		// Handle key = value pairs
		var equalIndex = line.indexOf('=');
		if (equalIndex > 0) {
			var key = line.substring(0, equalIndex).trim();
			var value = line.substring(equalIndex + 1).trim();
			
			// Remove quotes and parse arrays
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			} else if (value.startsWith('[') && value.endsWith(']')) {
				// Parse array
				var arrayContent = value.slice(1, -1);
				if (arrayContent.trim()) {
					value = arrayContent.split(',').map(function(item) {
						item = item.trim();
						if (item.startsWith('"') && item.endsWith('"')) {
							item = item.slice(1, -1);
						}
						return item;
					});
				} else {
					value = [];
				}
			} else if (value === 'true') {
				value = true;
			} else if (value === 'false') {
				value = false;
			} else if (!isNaN(value)) {
				value = parseInt(value);
			}
			
			if (currentSection) {
				config[currentSection][key] = value;
			} else {
				config[key] = value;
			}
		}
	}
	
	return config;
}

function generateTomlConfig(config) {
	var lines = [];
	
	// Add global settings first
	if (config.origin) {
		lines.push('# The hash of first block in a chain to know with which nodes to work');
		lines.push('origin = "' + config.origin + '"');
	}
	if (config.key_files && config.key_files.length > 0) {
		lines.push('# Paths to your key files to load automatically');
		lines.push('key_files = ["' + config.key_files.join('", "') + '"]');
	}
	if (config.check_blocks !== undefined) {
		lines.push('# How many last blocks to check on start');
		lines.push('check_blocks = ' + config.check_blocks);
	}
	
	// Add sections
	var sections = [
		{name: 'net', comment: '# Network settings'},
		{name: 'dns', comment: '# DNS resolver options'},
		{name: 'mining', comment: '#Mining options'}
	];
	
	for (var i = 0; i < sections.length; i++) {
		var section = sections[i];
		if (config[section.name] && Object.keys(config[section.name]).length > 0) {
			lines.push('');
			lines.push(section.comment);
			lines.push('[' + section.name + ']');
			
			// Add section-specific comments for important fields
			if (section.name === 'net') {
				if (config[section.name].peers) lines.push('# All bootstrap nodes');
				if (config[section.name].listen) lines.push('# Your node will listen on that address for other nodes to connect');
				if (config[section.name].public !== undefined) lines.push('# Set true if you want your IP to participate in peer-exchange, or false otherwise');
				if (config[section.name].yggdrasil_only !== undefined) lines.push('# Allow connections to/from Yggdrasil only (https://yggdrasil-network.github.io)');
			}
			if (section.name === 'dns') {
				if (config[section.name].listen) lines.push('# Your DNS resolver will be listening on this address and port (Usual port is 53)');
				if (config[section.name].threads) lines.push('# How many threads to spawn by DNS server');
				if (config[section.name].forwarders) lines.push('# AdGuard DNS servers to filter ads and trackers');
				if (config[section.name].bootstraps) lines.push('# Bootstrap DNS-servers to resolve domains of DoH providers');
			}
			if (section.name === 'mining') {
				if (config[section.name].threads !== undefined) lines.push('# How many CPU threads to spawn for mining, zero = number of CPU cores');
				if (config[section.name].lower !== undefined) lines.push('# Set lower priority for mining threads');
			}
			
			for (var key in config[section.name]) {
				var value = config[section.name][key];
				var line = key + ' = ';
				
				if (Array.isArray(value)) {
					line += '["' + value.join('", "') + '"]';
				} else if (typeof value === 'string') {
					line += '"' + value + '"';
				} else {
					line += value;
				}
				
				lines.push(line);
			}
		}
	}
	
	// Add additional sections if they don't exist
	if (!config.dns || !config.dns.bootstraps) {
		lines.push('');
		lines.push('# Bootstrap DNS-servers to resolve domains of DoH providers');
		lines.push('bootstraps = ["9.9.9.9:53", "94.140.14.14:53"]');
	}
	
	lines.push('');
	lines.push('# Hosts file support (resolve local names or block ads)');
	lines.push('#hosts = ["system", "adblock.txt"]');
	
	return lines.join('\n');
}

return view.extend({

	load: function() {
		return Promise.all([
			uci.load('alfis'),
			getServiceStatus(),
			L.resolveDefault(fs.read('/etc/alfis/alfis.toml'), '')
		]);
	},

	render: function(data) {
		var isRunning = data[1];
		var tomlContent = data[2];
		var tomlConfig = parseTomlConfig(tomlContent);
		
		// Store parsed config for save handler
		this.data = {
			tomlConfig: tomlConfig
		};
		
		var m, s, o;

		m = new form.Map('alfis', _('Alfis DNS'), _('Configure the Alternative Free Identity System DNS server'));

		// Main section with Enable and Status at the top
		s = m.section(form.TypedSection, 'alfis');
		s.anonymous = true;
		s.addremove = false;

		// Create a two-column layout for Enable and Status
		o = s.option(form.Flag, 'enabled', _('Enable'), _('Enable Alfis DNS service'));
		o.rmempty = false;
		
		// Add change handler to sync with system service enable/disable
		o.write = function(section_id, value) {
			// Call original write first
			form.Flag.prototype.write.call(this, section_id, value);
			
			// Sync with system startup scripts
			if (value === '1') {
				fs.exec('/etc/init.d/alfis', ['enable']).catch(function(err) {
					console.log('Failed to enable alfis service:', err);
				});
			} else {
				fs.exec('/etc/init.d/alfis', ['disable']).catch(function(err) {
					console.log('Failed to disable alfis service:', err);
				});
			}
		};

		o = s.option(form.DummyValue, '_status', _('Status'));
		o.cfgvalue = function() {
			console.log('Rendering status, isRunning:', isRunning);
			return isRunning ? 
				'<span style="color:green; font-weight:bold;">●</span> ' + _('Running') :
				'<span style="color:red; font-weight:bold;">●</span> ' + _('Not running');
		};
		o.rawhtml = true;

		// Configuration section
		s = m.section(form.TypedSection, 'alfis', _('Configuration'));
		s.anonymous = true;
		s.addremove = false;

		// Global settings - store in UCI with default values from TOML
		o = s.option(form.Value, 'origin', _('Origin Block Hash'), 
			_('The hash of the first block in the chain'));
		o.default = (tomlConfig.origin || "0000001D2A77D63477172678502E51DE7F346061FF7EB188A2445ECA3FC0780E");
		o.rmempty = false;

		o = s.option(form.Value, 'check_blocks', _('Check Blocks'), 
			_('How many last blocks to check on start'));
		o.datatype = 'uinteger';
		o.default = (tomlConfig.check_blocks || 8).toString();
		o.rmempty = false;

		// Network settings
		o = s.option(form.Value, 'net_listen', _('Network Listen Address'), 
			_('Address and port for other nodes to connect to'));
		o.default = (tomlConfig.net && tomlConfig.net.listen) || '[::]:4244';
		o.placeholder = '[::]:4244';
		o.rmempty = false;

		o = s.option(form.Flag, 'net_public', _('Public Node'), 
			_('Set true if you want your IP to participate in peer-exchange'));
		o.default = ((tomlConfig.net && tomlConfig.net.public !== undefined) ? tomlConfig.net.public : true) ? '1' : '0';
		o.rmempty = false;

		o = s.option(form.Flag, 'net_yggdrasil_only', _('Yggdrasil Only'), 
			_('Allow connections to/from Yggdrasil only'));
		o.default = ((tomlConfig.net && tomlConfig.net.yggdrasil_only !== undefined) ? tomlConfig.net.yggdrasil_only : true) ? '1' : '0';
		o.rmempty = false;

		o = s.option(form.TextValue, 'net_peers', _('Bootstrap Peers'), 
			_('List of bootstrap nodes to connect to (one per line)'));
		o.rows = 3;
		o.default = (tomlConfig.net && tomlConfig.net.peers) ? tomlConfig.net.peers.join('\n') : 
			'peer-v4.alfis.name:4244\npeer-v6.alfis.name:4244\npeer-ygg.alfis.name:4244';
		o.rmempty = false;

		// DNS settings
		o = s.option(form.Value, 'dns_listen', _('DNS Listen Address'), 
			_('Address and port for DNS server to listen on'));
		o.default = (tomlConfig.dns && tomlConfig.dns.listen) || '127.0.0.1:5353';
		o.placeholder = '127.0.0.1:5353';
		o.rmempty = false;

		o = s.option(form.Value, 'dns_threads', _('DNS Threads'), 
			_('How many threads to spawn for DNS server'));
		o.datatype = 'uinteger';
		o.default = ((tomlConfig.dns && tomlConfig.dns.threads) || 4).toString();
		o.placeholder = '4';
		o.rmempty = false;

		o = s.option(form.TextValue, 'dns_forwarders', _('DNS Forwarders'), 
			_('Upstream DNS servers to forward queries to (one per line)'));
		o.rows = 3;
		o.default = (tomlConfig.dns && tomlConfig.dns.forwarders) ? tomlConfig.dns.forwarders.join('\n') : 
			'https://dns.adguard.com/dns-query';
		o.rmempty = false;

		o = s.option(form.TextValue, 'dns_bootstraps', _('Bootstrap DNS Servers'), 
			_('Bootstrap DNS servers to resolve domains of DoH providers (one per line)'));
		o.rows = 2;
		o.default = (tomlConfig.dns && tomlConfig.dns.bootstraps) ? tomlConfig.dns.bootstraps.join('\n') : 
			'9.9.9.9:53\n94.140.14.14:53';
		o.rmempty = false;

		// Mining settings
		o = s.option(form.Value, 'mining_threads', _('Mining Threads'), 
			_('How many CPU threads to use for mining (0 = auto detect)'));
		o.datatype = 'uinteger';
		o.default = ((tomlConfig.mining && tomlConfig.mining.threads !== undefined) ? tomlConfig.mining.threads : 0).toString();
		o.placeholder = '0';
		o.rmempty = false;

		o = s.option(form.Flag, 'mining_lower', _('Lower Mining Priority'), 
			_('Set lower priority for mining threads'));
		o.default = ((tomlConfig.mining && tomlConfig.mining.lower !== undefined) ? tomlConfig.mining.lower : true) ? '1' : '0';
		o.rmempty = false;

		return m.render();
	}
});