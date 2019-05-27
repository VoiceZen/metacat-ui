define(["jquery", "app/renderers", "app/commandManager", "app/eventBus","jquery-layout", "jquery-jsonview", "app/profiler", "app/historyManager", "app/lightTrace", "app/settings", "app/tableRenderer"], function($, renderer, commandManager, eventBus, profiler, historyManager, lightTrace, settings, tableRenderer) {

    var showHelp = renderer.showHelp;
    var keepProfiling = false;

    if (typeof String.prototype.format !== 'function') {
        String.prototype.format = function() {
            var formatted = this, i;
            for (i = 0; i < arguments.length; i++) {
                formatted = formatted.replace("[" + i + "]", arguments[i]);
            }
            return formatted;
        };
    }


    eventBus.emit("appStarting");
    var transformer = require("app/transformer");

    function getHelpDisplayer(msg) {
        return function(){
            showHelp(msg);
        };
    }

    function attachToVM(event) {
        var vmId, errMsg = 'please click on the vm id value';
        try{ 
            vmId = $(event.target).attr("href");
            $(".ui-layout-west a.active").removeClass("active");
            $(event.target).addClass("active");
            if (vmId) {
                // showHelp("Trying to attach to vm, will show active functions on connect");
                commandManager
                    .runCommand("attachToVM", vmId)
                    .onSuccess(function(){
                        updateAttachedVMList(vmId);
                        getHelpDisplayer("Catalog picked from source");
                        setTimeout(function() { eventBus.emit("vmChanged", vmId);}, 1000);
                    })
                    .onFailure(getHelpDisplayer("Attach Failed"));
                return false;
            } else {
                errMsg = "Failed to attach";
            }
        }catch(error){
            console.log(error);
        }
        showHelp(errMsg);
        return false;
    }

    function updateAttachedVMList(vmId) {
        commandManager
            .runCommand("listAttachedVMs")
            .onSuccess(function(data) {
                renderer.renderAttachedVMs([vmId], vmId);
            });
    }

    function transformToReadableVMList(data) {
        var transformed = {'listName':'List of Data Catalog'};
        transformed.elements = data.map(function(db){
            return {'href':db.qualifiedName, 'display':db.name};
        });
        return transformed;
    }

    $(function() {
        var pageLayout = $('body').layout({
            resizeWhileDragging : true,
            north__slidable : false,
            north__resizable : false,
            north__spacing_open:0,
            north__closable : false,
            west__size: "25%",
            west__initClosed : false,
            onresize : function(){
                resetSectionSize();
            }
        });

        eventBus.setDelegate($('body')[0]);

        eventBus.on("appStarted", function() {
            eventBus.emit("listCatalogs");
        });

        eventBus.on("listCatalogs", function() {
            commandManager
                .runCommand("listCatalogs")
                .onSuccess(function(data) {
                    renderer
                        .renderView(transformToReadableVMList(data), "linkListRenderer")
                        .addHandler('click', attachToVM);
                });
            updateAttachedVMList();
        });

        eventBus.on("vmChanged", function(event) {
            commandManager.setCurrentVM(event.detail);
            renderer.renderCommands(commandManager.getCommands());
            eventBus.emit("runCommand", 'dumpThreads');
       });

        eventBus.on('runCommand', function(event) {
            var cmd = event.detail;
            renderer.setCommand(cmd);
            eventBus.emit('commandChanged');
        });
        
        eventBus.on('commandChanged', function(event) {
            var newCommand = renderer.getCommand();
            if (newCommand != "none") {
                commandManager
                    .runCommand(newCommand)
                    .onSuccess(function(data) {
                        if (data.renderer != null && data.renderer.length > 0) {
                            renderer.renderMain(data.payload, data.renderer);
                        } else {
                            renderer.renderMain(data);
                        }
                    });
            }
        });

        $('#user-commands').on('change', function(){
            eventBus.emit('commandChanged');
        });

        $('#attached-vms').on('change', function(event){
            var vmId = $(event.target).val();
            eventBus.emit('vmChanged', vmId);
        });

        transformer.register("dumpThreadNames", function(data) {return data.response.sort()});
        eventBus.emit("appStarted");
        
    });
});
