define(["app/eventBus", "app/commandManager", "app/renderers"], function(eventBus, commandManager, renderer){
    // lruList stores the last 10 command results
    var lruList = (function () {
        var marker = -1;
        var holder = {};
        var size = 10;
        return {
            getAll: function() {
                var results = [];
                var i = marker;
                while((i > -1) && ((marker - i) < size)) {
                    results.push(holder[i]);
                    i--;
                }
                return results;
            },
            put: function(data) {
                holder[++marker] = data;
                if (marker > size) {
                    delete holder[(marker - size)];
                }
            }
        }
    }());

    eventBus.on("commandCompleted", function(commandResult) {
        lruList.put(commandResult.detail);
    });

    commandManager
        .registerCommand("showHistory",
                         function showHistory(fulfill, reject, doesNotMatter, vmId) {
                             var entries = lruList.getAll();
                             var cleanEntries = [];
                             var i = 0;
                             var entry;
                             for (i = 0; i < entries.length; i++) {
                                 entry = entries[i];
                                 cleanEntries.push({"cmdName": entry.cmdName, "param": entry.param, "data":entry.data});
                             }
                             fulfill(cleanEntries);
                             
                         }, "Show the history of last 10 commands", false);

})

