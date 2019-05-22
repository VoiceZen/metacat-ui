// environment specfic settings
define(["jquery","app/eventBus"], function($, eventBus){

    var env = {
        "dev" : false
    };

    var mockMe = {"/vms":1, "/vms/attach":1, "/vms/attached":1, "/vms/response?vmId=19791":1};
    var realAjax = $.ajax;
    var lastCommand = "";

    function mockAjax(opts) {
        var url = opts.url;
        var fileName = "";
        if (url === "/vms/command") {
            // most commands are method names with "()"
            lastCommand = (opts.data)? JSON.parse(opts.data).command.slice(0,-2):"";
            return {
                done: function(cb) {
                    cb.call('{"response":true}');
                }
            }
        } else if (mockMe[url]){
            fileName = (lastCommand && lastCommand.length > 0)? lastCommand: url.replace(RegExp("/","g"),"_")
            return realAjax({url:"./js/mocks/[0].js".format(fileName), dataType:"json"});
        } else {
            return realAjax(opts);
        }
    }

    function loadSettings() {
        $.ajax = (env.dev)? mockAjax: realAjax;
        eventBus.emit("settingsLoaded");
    }
    
    eventBus.on("loadSettings", loadSettings);
    eventBus.on("appStarting", function(){eventBus.emit("loadSettings")});

    return {
        env : env
    }
});

// "/vms/command"
// "/vms/response?vmId=19791"

// {vmId: "19791", command: "dumpThreadNames()"}

// {"timestamp":1461141460495,"response": ["DefaultQuartzScheduler_Worker-5","qtp2050404090-37","DefaultQuartzScheduler_Worker-4","HashSessionScavenger-0","Attach Listener","HashSessionScavenger-2","qtp2050404090-31 Acceptor0 SelectChannelConnector@0.0.0.0:8080","DefaultQuartzScheduler_Worker-8","Signal Dispatcher","Finalizer","Reference Handler","Timer-0","DefaultQuartzScheduler_QuartzSchedulerThread","DefaultQuartzScheduler_Worker-9","DefaultQuartzScheduler_Worker-1","DefaultQuartzScheduler_Worker-3","qtp2050404090-30 Selector0","HashSessionScavenger-1","DefaultQuartzScheduler_Worker-6","qtp2050404090-36","main","DefaultQuartzScheduler_Worker-10","qtp2050404090-34","qtp2050404090-33","qtp2050404090-35","qtp2050404090-32","DefaultQuartzScheduler_Worker-2","GC Daemon","DefaultQuartzScheduler_Worker-7"]}


// require("app/settings").env.dev = true;
// require("app/eventBus").emit("loadSettings");
