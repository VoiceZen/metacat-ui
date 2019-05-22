define(["jquery", "app/eventBus", "app/renderers", "app/commandManager", "app/treeRenderer", "app/datasource"], function($, eventBus, renderer, commandManager, treeRenderer, ds){
    var keepProfiling = false;
    var lastSegment = "";
    var rowDelimiter = "~#";

    renderer.registerRenderer("tree", treeRenderer.render);
    commandManager
        .registerCommand("startProfiling",
                         function profileVM(fulfill, reject, classLocations, vmId) {
                             ds.forJSON("/vms/profile", 
                                        {'vmId': ''+vmId, 'locations':classLocations}, 'POST')
                                 .then(function(data){
                                     fulfill(data);
                                 });
                         },
                         "starts profiling the currently selected VM", true);

    commandManager
        .registerCommand("stopProfiling",
                         function stopProfiling(fulfill, reject, param, vmId) {
                             ds.forJSON("/vms/unprofile", 
                                        {'vmId': ''+vmId}, 'POST')
                                 .then(function(data){
                                     fulfill(data);
                                 });
                         },
                         "stops profiling the currently selected VM", true);

    commandManager
        .registerCommand("getProfiledResults",
                         function(fulfill, reject, param, vmId) {
                             commandManager.runCommandOnVM(fulfill, reject, "get-all-entries", vmId, "/vms/rawresponse");
                         },
                         "gets results of the current profiling info", true);

    eventBus.on("rendered", function() {
        var currCmd = renderer.getCommand();
        var profilerActionSelector;
        if (currCmd == "getClassLocations") {
            if ($(".node-selector").length === 0) {
                renderer.getMainSection(".data .level1 li span").before(function(){return "<input type='checkbox' class='node-selector'></input>";});
                profilerActionSelector = renderProfilerAction();
                addProfilerEventHandler(profilerActionSelector);
            }
        }
    });

    eventBus.on('startProfiling', function(event) {
        keepProfiling = true;
        commandManager
            .runCommand('startProfiling', event.detail)
            .onSuccess(function(data) {
                eventBus.emit('updateProfiledResults');
            });
    });

    eventBus.on('stopProfiling', function(event) {
        keepProfiling = false;
        commandManager
            .runCommand('stopProfiling')
            .onSuccess(function(data) {
                eventBus.emit('stoppedProfiling');
            });

    });

    eventBus.on('updateProfiledResults', function(event) {
        if (keepProfiling) {
            commandManager
                .runCommand('getProfiledResults')
                .onSuccess(function(data) {
                    eventBus.emit('displayProfiledResults', data);
                })
                .onFailure(function(data) {
                    renderer.showHelp("No data yet from the profiler, continuing the profiling");
                });
            // double check as it is possible that we changed in between 
            if (keepProfiling) {
                setTimeout(function(){eventBus.emit('updateProfiledResults');}, 5000);
            }
        }
    });



    eventBus.on('displayProfiledResults', function(event) {
        var profiledData = event.detail;
        var dataActionSelector = null;
        var dataToCrunch = "";
        var splits;
        if (keepProfiling) {
            profiledData = (profiledData)? profiledData.response: null;
            if (profiledData) {
                dataToCrunch = lastSegment + profiledData;
                splits = dataToCrunch.split("~#");
                if (splits && splits.length > 0) {
                    if (isLastSegmentInValid(profiledData)) {
                        lastSegment = splits[splits.length - 1];
                        splits.splice(-1,1);
                    } else {
                        lastSegment = "";
                    }
                    dataActionSelector = createDataSection();
                    renderer.render("body > .ui-layout-center > .data", createTree(splits), "tree");
                }
            }
        }
    });

    eventBus.on('forceKeepProfiling', function() {keepProfiling = true});

    function createDataSection() {
        if (renderer.getMainSection(".data .data").length === 0) {
            renderer.getMainSection(".data").append("<div class='data'></div>");
        }
        return ".data";
    }
    function renderProfilerAction() {
        var profilerActionId = 'profilingAction';
        renderer.getMainSection(".data").append("<button class='btn btn-primary' id='"+profilerActionId+"' type='button'>Start Profiling</button>");
        return "#"+profilerActionId;
    }

    function isLastSegmentInValid(segments) {
        var length = segments.length;
        return !((segments.charAt(length - 2) == rowDelimiter.charAt(0) ) && (segments.charAt(length - 1) == rowDelimiter.charAt(1)));
    }

    function addProfilerEventHandler(selector) {
        $(selector).on('click', function(){
            if (keepProfiling) {
                eventBus.emit("stopProfiling"); 
                keepProfiling = false;
                $(selector).html('Start Profiling');
            } else {
                var classLocations = [];
                renderer.getMainSection(".level1 li input:checkbox:checked").each(function(){
                    classLocations.push(unescape($(this).next('span').text().replace(/"/g,'').replace("file:","")));
                });
                
                if (classLocations.length > 0) {
                    eventBus.emit("startProfiling", classLocations);
                    keepProfiling = true; 
                    $(selector).html('Stop Profiling');
                } else {
                    keepProfiling = false; 
                    renderer.showHelp("Must select at least one jar");
                }
            }
        });
    }

    // converts [s,e,s,s,e,s] to a tree (s is start and e is end)
    function createTree(entries) {
        var parser = /(\d*) (\d*) (start|end) (\S*) (\S*)/;
        var splits = null;
        var i = 0;
        var root = new Node("Trace of all invoked methods");
        var parentChain = {};
        for (i = 0; i < entries.length; i++) {
            splits = parser.exec(entries[i]);
            if (splits) {
                processNode(parentChain, splits);
            }
        }
        for (i in parentChain) {
            root.addChild(parentChain[i][0]);
        }
        return root;
    }

    function processNode(parentChain, splits) {
        var tId, threadStack, lastNode;
        tId = splits[1];
        if (splits[3] === "start") {
            var entry = new Node("child", splits);
            threadStack = parentChain[tId];
            if (threadStack == null) {
                threadStack = createThreadStack(parentChain, tId);
            }
            threadStack[threadStack.length - 1].addChild(entry);
            threadStack.push(entry);
        } else {
            threadStack = parentChain[tId];
            if (threadStack) {
                lastNode = threadStack[threadStack.length - 1];
                if (threadStack.length > 1) {
                    lastNode.completed = true;
                    lastNode.totalTime = splits[2] - lastNode.tstamp;
                    // move stack one level up
                    threadStack.splice(-1, 1);
                } else {
                    // last frame in stack, so this is a end that does not have a start in the current data (i.e [s,e,e])
                    var entry = new Node("child", splits);
                    entry.needsMerge = true;
                    // move all children of frame to this node
                    entry.children = lastNode.children;
                    lastNode.children = [entry];
                }
            } else {
                // no stack for this thread id
                threadStack = createThreadStack(parentChain, tId);
                var entry = createMergeMeNode(splits);
                threadStack[threadStack.length - 1].addChild(entry);
            }
        }
    }

    function createThreadStack(parentChain, threadId) {
        var threadStack = [];
        threadStack.push(new Node("Thread "+threadId));
        parentChain[threadId] = threadStack;
        return threadStack;
    }

    function createMergeMeNode(splits) {
        var entry = new Node("child", splits);
        entry.needsMerge = true;
        return entry;
    }

    function Node(name, splits) {
        if (splits) {
            this.tId =splits[1];
            this.tstamp = splits[2];
            this.state=splits[3]; 
            this.clsName=splits[4]; 
            this.unQualifiedMethodName=splits[5];
            this.methodName = splits[4].replace(/\//g,".") + "." + splits[5]+"()";
        } else {
            this.methodName = name;
        }
        this.children = [];
        this.completed = false;
        this.needsMerge = false;
        this.addChild = function(entry) {
            this.children.push(entry);
        };
        this.toString = function() {
            return this.tId + "->" + this.methodName;
        };
        this.totalTime = -1;
    }

    function meToString(d, mDepth, cDepth) {
        var str = "", i;
        str = (d.tId)? d.tId + " " + d.tstamp + " " + d.state + " " + d.clsName + " " + d.unQualifiedMethodName
            +"~#": "";
        if (d.children && cDepth < mDepth) {
            for (i = 0; i < d.children.length; i++){
                str += meToString(d.children[i], mDepth, cDepth + 1);
            } 
        }
        str += (d.tId)? d.tId + " " + d.tstamp + " end "  + d.clsName + " " + d.unQualifiedMethodName
            +"~#": "";
        return str;
    }

//var eb = require('app/eventBus');
///$("body > .ui-layout-center > .data").html('<div class="data-profiler"></div>')
//eb.emit('forceKeepProfiling');
//eb.emit('displayProfiledResults', {"response":data});

});
