(function(global){

	// helpers
	var camelize = function(str){
		return str.replace(/-+(.)?/g, function(match, chr){ 
			return chr ? chr.toUpperCase() : '' 
		});
	},
		each = function( o, cb){
			var i, len;

			// weak array detection, but we only use this internally so don't
			// pass it weird stuff
			if ( typeof o.length == 'number' && (o.length - 1) in o) {
				for ( i = 0, len = o.length; i < len; i++ ) {
					cb.call(o[i], o[i], i, o);
				}
			} else {
				for ( i in o ) {
					if(o.hasOwnProperty(i)){
						cb.call(o[i], o[i], i, o);
					}
				}
			}
			return o;
		},
		map = function(o, cb) {
			var arr = [];
			each(o, function(item, i){
				arr[i] = cb(item, i);
			});
			return arr;
		},
		isString = function(o) {
			return typeof o == "string";
		},
		extend = function(d,s){
			each(s, function(v, p){
				d[p] = v;
			});
			return d;
		},
		dir = function(uri){
			var lastSlash = uri.lastIndexOf("/");
			if(lastSlash !== -1) {
				return uri.substr(0, lastSlash);
			} else {
				return uri;
			}
		},
		last = function(arr){
			return arr[arr.length - 1];
		};


	var filename = function(uri){
		var lastSlash = uri.lastIndexOf("/"),
			matches = ( lastSlash == -1 ? uri : uri.substr(lastSlash+1) ).match(/^[\w-\s\.]+/);
		return matches ? matches[0] : "";
	};
	
	var ext = function(uri){
		var fn = filename(uri);
		var dot = fn.lastIndexOf(".");
		if(dot !== -1) {
			return fn.substr(dot+1);
		} else {
			return "";
		}
	};
	
	var normalize = function(name, loader){

		var last = filename(name),
			extension = ext(name);
		// if the name ends with /
		if(	name[name.length -1] === "/" ) {
			return name+filename( name.substr(0, name.length-1) );
		} else if(	!/^(\w+(?:s)?:\/\/|\.|file|\/)/.test(name) &&
			// and doesn't end with a dot
			 last.indexOf(".") === -1 
			) {
			return name+"/"+last;
		} else {
			if(extension === "js") {
				return name.substr(0, name.lastIndexOf("."));
			} else {
				return name;
			}
		}
	};



var makeSteal = function(System){
	
	var configDeferred,
		devDeferred,
		appDeferred;

	var steal = function(){
		var args = arguments;
		var afterConfig = function(){
			var imports = [];
			var factory;
			each(args, function(arg){
				if(isString(arg)) {
					imports.push( steal.System['import']( normalize(arg) ) );
				} else if(typeof arg === "function") {
					factory = arg;
				}
			});
			
			var modules = Promise.all(imports);
			if(factory) {
				return modules.then(function(modules) {
			        return factory && factory.apply(null, modules);
			   });
			} else {
				return modules;
			}
		};
		if(steal.config().env === "production") {
			return afterConfig();
		} else {
			// wait until the config has loaded
			return configDeferred.then(afterConfig,afterConfig);
		}
		
	};
	
	steal.System = System;
	
	var configData = {
		env: "development"
	};
	
	steal.config = function(data, value){
		if(isString(data)) {
			var name = data;
			if(arguments.length >= 2) {
				
			} else {
				
				var special = configSpecial[name];
				if(special && special.get) {
					return special.get();
				} else {
					return configData[name];
				}
			}
		} else if(typeof data === "object") {
			data = extend({},data);
			each(configSpecial, function(special, name){
				if(special.set && data[name]){
					var res = special.set(data[name]);
					if(res !== undefined) {
						configData[name] = res;
					} 
					delete data[name];
					
				}
			});
			
			extend(configData, data);
			
		} else {
			var config = {};
			
			each(configSpecial, function(special, name){
				if(special.get){
					config[name] = special.get();
				}
			});
			return extend(config, configData);	
		}
	};

var getSetToSystem = function(prop){
	return {
		get: function(){
			return steal.System[prop];
		},
		set: function(val){
			if(typeof val === "object" && typeof steal.System[prop] === "object") {
				steal.System[prop] = extend(steal.System[prop] || {},val || {});
			} else {
				steal.System[prop] = val;
			}
		}
	};
};

var configSpecial = {
	env: {
		set: function(val){
			addProductionBundles();
			return val;
		}
	},
	root: getSetToSystem("baseURL"),
	config: {
		set: function(val){
			var name = filename(val),
				root = dir(val);
			System.paths["stealconfig"] = name;
			configSpecial.root.set( (root === val ? "." : root)  +"/");
		}
	},
	paths: getSetToSystem("paths"),
	map: getSetToSystem("map"),
	startId: {
		set: function(val){
			configSpecial.main.set(  normalize(val) );
		},
		get: function(){
			return System.main;
		}
	},
	main: {
		get: getSetToSystem("main").get,
		set: function(val){
			System.main = val;
			addProductionBundles();
		}
	},
	meta: getSetToSystem("meta")
};


var addProductionBundles = function(){
	if(configData.env === "production" && System.main) {		
		var main = System.main,
			bundlesDir = System.bundlesPath || "bundles/",
			bundleName = bundlesDir+filename(main);
		
		System.meta[bundleName] = {format:"amd"};
		System.bundles[bundleName] = [main];
	}
};

	

	
	var getScriptOptions = function () {
	
		var options = {},
			parts, src, query, startFile, env,
			scripts = document.getElementsByTagName("script");
	
		var script = scripts[scripts.length - 1];
	
		if (script) {
	
			// Split on question mark to get query
			parts = script.src.split("?");
			src = parts.shift();
			
			query = parts.join("?");
	
			// Split on comma to get startFile and env
			parts = query.split(",");
	
			if (src.indexOf("steal.production") > -1) {
				options.env = "production";
			}
	
			// Grab startFile
			startFile = parts[0];
	
			if (startFile) {
				options.startId = startFile;
			}
	
			// Grab env
			env = parts[1];
	
			if (env) {
				options.env = env;
			}
	
			// Split on / to get rootUrl
			parts = src.split("/");
			var lastPart = parts.pop();
			
			if(lastPart.indexOf("steal") === 0 && !System.paths["steal/dev/dev"]) {
				options.paths = {
					"steal/*": parts.join("/")+"/*.js",
					"@traceur": parts.slice(0,-1).join("/")+"/traceur/traceur.js"
				};
				
			}
			
			if ( last(parts) === "steal" ) {
				parts.pop();
				if ( last(parts) === "bower_components" ) {
					parts.pop();
				}
			}
			var root = parts.join("/");
			options.root = root+"/";
			each(script.attributes, function(attr){
				var optionName = 
					camelize( attr.nodeName.indexOf("data-") === 0 ?
						 attr.nodeName.replace("data-","") :
						 attr.nodeName );
						 
				options[optionName] = attr.value;
			});
			
		}
	
		return options;
	};
	
	var getOptionsFromStealLocation = function(){
		var options = {};
		if(typeof __dirname === "string" && !System.paths["steal/dev/dev"]) {
			options.paths = {
				"steal/*": __dirname+"/*.js",
				"@traceur": __dirname.split("/").slice(0,-1).join("/")+"/traceur/traceur.js"
			};
		}
		return options;
	};
	
	steal.startup = function(config){
		
		// get options from the script tag
		if(global.document) {
			var urlOptions = getScriptOptions();
		} else {
			var urlOptions = getOptionsFromStealLocation();
		}
		if(!System.map.css) {
			System.map.css = "steal/css";	
		}
	
		// B: DO THINGS WITH OPTIONS
		// CALCULATE CURRENT LOCATION OF THINGS ...
		steal.config(urlOptions);
		
		var options = steal.config();
	
		// mark things that have already been loaded
		each(options.executed || [], function( i, stel ) {
			System.register(stel,[],function(){});
		});
		
		// immediate steals we do
		var steals = [];
	
		// add start files first
		if ( options.startIds ) {
			/// this can be a string or an array
			steals.push.apply(steals, isString(options.startIds) ? [options.startIds] : options.startIds);
			options.startIds = steals.slice(0);
		}
	
		// we only load things with force = true
		if ( options.env == "production" ) {
			
			return appDeferred = steal.System.import(steal.System.main)["catch"](function(e){
				console.log(e);
			});
			
		} else if(options.env == "development"){
			
			configDeferred = steal.System.import("stealconfig");
			
			devDeferred = configDeferred.then(function(){
				// If a configuration was passed to startup we'll use that to overwrite
				// what was loaded in stealconfig.js
				if(config) {
					steal.config(config);
				}

				return steal("steal/dev");
			},function(){
				console.log("steal - error loading stealconfig.");
				return steal("steal/dev");
			});
			
			appDeferred = devDeferred.then(function(){
				
				// if there's a main, get it, otherwise, we are just loading
				// the config.
				return steal.System.main ? 
					System.import(steal.System.main):
					configDeferred;
			}).then(function(){
				if(steal.dev) {
					steal.dev.log("app loaded successfully")
				}
			}, function(error){
				console.log("error",error,  error.stack);
			});
			return appDeferred;
		}
	};

	return steal;	
};


  

  // AMD Module Format Detection RegEx
  // define([.., .., ..], ...)
  // define(varName); || define(function(require, exports) {}); || define({})
  var stealRegEx = /(?:^\s*|[}{\(\);,\n\?\&]\s*)steal\s*\(\s*((?:"[^"]+"\s*,|'[^']+'\s*,\s*)*)/;

  function prepareDeps(deps, meta) {
    // remove duplicates
    for (var i = 0; i < deps.length; i++)
      if ([].lastIndexOf.call(deps, deps[i]) != i)
        deps.splice(i--, 1);

    return deps;
  };

  
  var addFormat = function(loader){
  	  function makeRequire(parentName, deps, depsNormalized) {
	    return function(names, callback, errback) {
	      if (typeof names == 'string' && indexOf.call(deps, names) != -1)
	        return loader.getModule(depsNormalized[indexOf.call(deps, names)]);
	      return require(names, callback, errback, { name: parentName });
	    };
	  };
	  function prepareExecute(depNames, load) {
	    var meta = load.metadata;
	    var deps = [];
	    for (var i = 0; i < depNames.length; i++) {
	      var module = loader.get(depNames[i]);
	      if (module.__useDefault) {
	        module = module['default'];
	      }
	      else if (!module.__esModule) {
	        // compatibility -> ES6 modules must have a __esModule flag
	        // we clone the module object to handle this
	        var moduleClone = { __esModule: true };
	        for (var p in module)
	          moduleClone[p] = module[p];
	        module = moduleClone;
	      }
	      deps[i] = module;
	    }
	
	    var module, exports;
	
	    return {
	      deps: deps,
	      module: module || exports && { exports: exports }
	    };
	  }
  	
  	
  	loader.formats.unshift('steal');
  	loader.format.steal = {
	    detect: function(load) {
	      return !!load.source.match(stealRegEx);
	    },
	    deps: function(load) {
		  var global = loader.global;
	      var deps = [];
	      var meta = load.metadata;
	      var oldSteal = global.steal;
		
	      global.steal = function(){
	          for( var i = 0; i < arguments.length; i++ ) {
	          if (typeof arguments[i] == 'string') {
	            deps.push( arguments[i] );
	          } else {
	            meta.factory = arguments[i];
	          }
	        }
	      };
	
	      loader.__exec(load);
	      global.steal = oldSteal;
	      // deps not defined for an AMD module that defines a different name
	      deps = deps || [];
	
	      deps = prepareDeps(deps, meta);
	
	      global.define = undefined;
	
	      meta.deps = deps;
	
	      return deps;
	
	    },
	    execute: function(depNames, load ) {
	      if (!load.metadata.factory)
	        return;
	      var execs = prepareExecute(depNames, load);
	      return load.metadata.factory.apply(loader.global, execs.deps) || execs.module && execs.module.exports;
	    },
	    normalize: function(name, refererName, refererAddress, baseNormalize){
	      return baseNormalize(normalize(name, this), refererName, refererAddress);
	    }
	  };
  	return loader;
  };
  
  if(typeof System !== "undefined") {
  	addFormat(System);
  }

  


	if (typeof window != 'undefined') {
		window.steal = makeSteal(System);
		window.steal.startup();
		window.steal.addFormat = addFormat;
    }
    else {
    	var steal = makeSteal(System);
		steal.System = System;
		steal.dev = require("./dev/dev.js");
		steal.clone = makeSteal;
		module.exports = steal;
		global.steal = steal;
		global.steal.addFormat = addFormat;
    }
  	
  
})(typeof window == "undefined" ? global : window);