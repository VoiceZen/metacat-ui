requirejs.config({
    "baseUrl": "./js/",
    "paths": {
        "app": "./app",
        "jquery": "../lib/jquery-1.9.1.min",
        "promise": "../lib/promise-6.0.0",
        "coffee-script": "../lib/coffee-script-1.7.1.min",
        "jquery-layout": "../lib/layout/jquery.layout.min",
        "jquery-jsonview": "../lib/jquery.jsonview",
        "d3": "../lib/d3.v3.min"
    },
    shim: {
        "jquery-ui-latest": ["jquery"],
        "jquery-layout" : ["jquery"],
        "jquery-jsonview": ["jquery", "coffee-script"],
        "promise" : {exports: 'Promise'}
    }
});

// Load the main app module to start the app
requirejs(["app/main"]);
