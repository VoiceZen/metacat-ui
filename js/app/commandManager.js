define(["app/datasource", "promise", "app/eventBus", "app/transformer"], function(ds, Promise, eventBus, transformer){
    var currentlyAttaching = false;
    var currentVM = null;
    var commandRegistry = {};
    var commonRoot = "/api/mds/v1/catalog/";

    function CommandResult(cmdName, param, promise) {
        return {
            cmdName : cmdName,
            param : param || "",
            promise : promise,
            onSuccess: function(callBack) {
                var self = this;
                this.promise.then(function(data) {
                    
                    self.data = transformer.transform(cmdName, data);
                    eventBus.emit("commandCompleted", self);
                    callBack(data)
                }, null);
                return this;
            },
            onFailure: function(callBack) {
                this.promise.then(null, this.callBack);
                return this;
            },
            toString: function() {
                return cmdName + " [" + param + "] at " +Date.now();
            }
        };
    }

    function runCommand(cmdName, param) {
        // just in case someone changes it once the command start
        var vmId = currentVM;
        var cmd = commandRegistry[cmdName];
        if (cmd) {
            return new CommandResult(cmdName, param, cmd.operation.call(this, param, vmId));
        } else {
            throw new Error("Command name " +cmdName+" not recognized");
        }
    }

    function runCommandOnVM(fulfill, reject, command, vmId, responseUrl) {
        responseUrl = responseUrl || "/vms/response";
        ds.forJSON("/vms/command", {'vmId': vmId, 'command':command}, 'POST')
            .then(function(data) {
                ds.forJSON(responseUrl + "?vmId="+vmId, null,'GET', true)
                    .then(function(data) {fulfill(data);}, 
                          function(){
                              reject("command " + command + " on vm "+vmId + "could not be completed successfully");});
            });
        
    }

    function setCurrentVM(vmId) {
        currentVM = '' + vmId;
    }

    function registerCommand(name, operation, helpMsg, internal) {
        commandRegistry[name] = {
            "name" : name,
            "help": helpMsg,
            "operation": function(param, vmId) {
                var promise = new Promise(function(fulfill, reject) {
                    if (operation) {
                        operation.call(this, fulfill, reject, param, vmId);
                    } else {
                        runCommandOnVM(fulfill, reject, name + '()', currentVM);
                    }
                });
                return promise;
            },
            "editor" : (internal)? false:true
        };
        eventBus.emit('commandRegistered', {'name': name});
    }

    registerCommand("attachToVM",
                    function attachToVM(fulfill, reject, vmId) {
                        // interpreting params as vmId
                        currentVM = vmId;
                        fulfill(vmId);
                    },
                    "Attach to the Catalog", true);


    registerCommand("detachFromVM", 
                    function detachFromVM(fulfill, reject, param, vmId) {
                        ds.forJSON("/vms/detach", {'vmId': ''+vmId}, 'POST')
                            .then(function(data){fulfill(data);});
                    },
                    "Detach from the Catalog");

    registerCommand("listAttachedVMs",
                    function listAttachedVMs(fulfill, reject) {
                        fulfill([])
                    },
                    "List all monitored catalogs", true);

    registerCommand("direct", runCommandOnVM, "Run this Query", true);

    registerCommand("listCatalogs",
                    function listAttachedVMs(fulfill, reject) {
                        ds.forJSON(commonRoot)
                            .then(function(data){
                                var promises = data.map(function(z){
                                    var url = commonRoot + z.catalogName;
                                    return ds.forJSON(url);
                                });
                                Promise.all(promises)
                                .then(function(datas){
                                    dbs = datas.flatMap(function(data) {
                                        var parentName = data.name.qualifiedName;
                                        return data.databases.map(function(db) {
                                            return {'parent': parentName, 'name': db, 'qualifiedName': parentName + "/" + db};
                                        });
                                    });
                                    fulfill(dbs);
                                })
                            });
                    },
                    "List catalogs", true);

    registerCommand("dumpThreads", 
        function showDetails(fulfill) {
            var splits = currentVM.split("/");
            if (splits.length > 2) {
                eventBus.emit("runCommand", 'dumpColumns');
            } else {
                eventBus.emit("runCommand", 'dumpTables');
            }
        }, 
        "Get Details");

    registerCommand("dumpTables", function showTables(fulfill, reject) {
        var splits = currentVM.split("/");
        var catalogName = splits[0];
        var dbName = splits[1];
        var url = commonRoot + catalogName + "/database/" + dbName;
        ds.forJSON( url + "?includeUserMetadata=true&includeTableNames=true")
        .then(
            function(data) {    
                var qualifiedName = data.name.qualifiedName;
                txedData = {
                    "listName": qualifiedName, 
                    "elements": data.tables.map(function(x){ 
                        return {"href": qualifiedName + "/" + x, "display":x}}
                        ) 
                    };
                fulfill(txedData);
            }, 
            function() {
                reject("Could not get Catalog");
            });
    }, "Show Tables")

    registerCommand("dumpColumns", function showTables(fulfill, reject) {
        var splits = currentVM.split("/");
        var catalogName = splits[0];
        var dbName = splits[1];
        var tableName = splits[2];
        var url = commonRoot + catalogName + "/database/" + dbName;
        ds.forJSON( url + "/table/" + tableName + "?includeInfo=true&includeDefinitionMetadata=true&includeDataMetadata=true")
        .then(
            function(data) {
                var txedData = {"renderer": "table", "payload":data.fields}
                fulfill(txedData);
            }, 
            function() {
                reject("Could not get Catalog");
            });
    }, "Show Columns")

    registerCommand("dumpThreadNames", null, "Show Table Summary");


    function getDirectCommandWraper(cmdName) {
        return function(fulfill, reject) {
            runCommandOnVM(fulfill, reject, cmdName + '()', currentVM);
        };
    }

    return {
        "registerCommand" : registerCommand,
        "runCommand":runCommand,
        "setCurrentVM" : setCurrentVM,
        "runCommandOnVM" : runCommandOnVM,
        "getCommands" : function() {
            var commands = [];
            var command = null;
            for (var el in commandRegistry) {
                command = commandRegistry[el];
                if (command.internal !== true) {
                    commands.push(command);
                }
            }
            return commands;
        }
    };
});
