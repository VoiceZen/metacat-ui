define(["jquery", "app/eventBus", "app/renderers", "app/commandManager", "app/datasource"], function($, eventBus, renderer, commandManager, ds){

    var sampleTraces = false;
    var prevState = null;
    var methodExtractor = new RegExp(".*\\.(\\S*\\.\\S*)\\(.*");

    renderer.registerRenderer("threadView", renderThreadView);
    eventBus.on("sampleThreadDumps", function() {
        commandManager.runCommand("dumpThreads")
            .onSuccess(function(data) {
                eventBus.emit('displaySampleDelta', data);
            });
        if (sampleTraces) {
            setTimeout(function(){eventBus.emit('sampleThreadDumps');}, 1500);
        }
    });

    commandManager
        .registerCommand("lightTrace", 
                         function lightTrace(fulfill, reject, doesNotMatter, vmId) {
                             sampleTraces = true;
                             eventBus.emit("sampleThreadDumps");
                         }, "Show thread activity");

    eventBus.on("stopSampling", function() {
        sampleTraces = false;
        prevState = null;
    });

    eventBus.on("displaySampleDelta", function(event) {
        var data = transform(groupThreads(event.detail.response));
        renderer.renderMain(data, "threadView");
    });

    /**
     * State 0: group threads by top three methods on stack
     * State i: for all groups with only one member add previous state
     */
    function groupThreads(threadDump) {
        var newGroups = groupByMethodNames(threadDump);
        var newThread, oldThread;
        var members = null;
        var i = 0;
        if (prevState) { // state n.e 0
            var nameVsThreadMap = getNameVsThreadMap(prevState);
            // for all single member groups, restore last state too
            for (var groupName in newGroups) {
                members = newGroups[groupName];
                if (members.length == 1) {
                    newThread = members[0];
                    oldThread = nameVsThreadMap[newThread.name];
                    if (oldThread) {
                        if (oldThread.topStack.indexOf(newThread.topStack) == -1) {
                            newThread.topStack += " " + oldThread.topStack;
                            newThread.showsActivity = true;
                        }
                    }
                }
            }
        }
        prevState = newGroups;
        return newGroups;
    }

    function groupByMethodNames(threadDump) {
        var threadGroups = {};
        var signature = null;
        var threadStack = null;
        for (var threadName in threadDump) {
            threadStack = threadDump[threadName];
            signature = threadStack.slice(0,3).join(" ");
            if (!(threadGroups[signature])) {
                threadGroups[signature] = [];
            }
            threadGroups[signature].push({ 'name': threadName, 'topStack': signature});
        }
        return threadGroups;
    }

    function getNameVsThreadMap(someMap) {
        var newMap = {}, values, i = 0;
        for (var key in someMap) {
            values = someMap[key];
            for (i = 0; i < values.length; i++) {
                newMap[values[i].name] = values[i];
            }
        }
        return newMap;
    }


    function transform(data) {
        var d3Data = [], groupElement;
        for (var threadGroup in data) {
            groupElement = {'names':[], 'stacks':[]};
            if (data[threadGroup].length == 1) {
                groupElement.names.push(data[threadGroup][0].name);
                groupElement.stacks.push(data[threadGroup][0].topStack.split(") "));
                groupElement.recentlyChanged = data[threadGroup][0].showsActivity;
            } else {
                groupElement.names = extractNames(data[threadGroup]);
                groupElement.stacks.push(threadGroup.split(") "));
            }
            d3Data.push(groupElement);
        }
        d3Data.sort(function(obj1, obj2) {
            if (obj1.recentlyChanged) {
                return 1;
            } else if (obj2.recentlyChanged) {
                return -1;
            } else {
                return 0;
            }
        });
        return d3Data;
    }

    function extractNames(nameContainers) {
        var names = [], i;
        for ( i = 0; i < nameContainers.length; i++) {
            names.push(nameContainers[i].name);
        }
        return names;
    }

    function extractMethodName(data) {
        if (data && data.match) {
            var splits = data.match(methodExtractor);
            if (splits && splits.length === 2) {
                return splits[1];
            } else {
                return data;
            }
        }
    }

    function addStopSamplingButton(parent) {
        $(parent).before("<button class='btn btn-primary' id='stopSampling' type='button'>Stop Tracing</button>");
    }

    function addStopSamplingButtonAction() {
        $('#stopSampling').on('click', function(){
            $('#stopSampling').remove();
            eventBus.emit("stopSampling");
        }); 
    }


    function renderThreadView(parent, data) {
        var width = $(parent).width();
        var i = 0, lastY = 0, lastEl;
        var margins = {tNameGapY:30, tOffset:40, offsetX : 30, stackNameWidth: Math.ceil(0.2 * width), stackNameGap: Math.ceil(0.03 * width)};
        $(parent).html("");

        // as text elements can outgun the width, we use wrap to prefix it with ...
        function wrap() {
            var self = d3.select(this),
                textLength = self.node().getComputedTextLength(),
                text = self.text();
            while (textLength > (margins.stackNameWidth - 2 * margins.stackNameGap) && text.length > 0) {
                text = text.slice(1);
                self.text('...' + text);
                textLength = self.node().getComputedTextLength();
            }
        }

        if ($("#stopSampling").length === 0 && sampleTraces) {
            addStopSamplingButton(parent);
            addStopSamplingButtonAction();
        }

        // basic layout
        data[0].y = margins.tOffset / 2;
        for (i = 1; i < data.length; i++) {
            lastEl = data[i - 1];
            lastY = lastY + margins.tOffset + Math.max(lastEl.names.length, lastEl.stacks.length) * margins.tNameGapY;
            data[i].y = lastY;
        }

        var svg = d3.select(parent).append("svg").attr("width", width).attr("height", lastY + margins.tOffset).append("g");
        var nodes = svg.selectAll("g.node").data(data);
        var nodeEntries = nodes.enter().append("g").attr("class", "node").attr("transform", function(d){return "translate(" + margins.offsetX + ","+d.y+")"});

        nodeEntries.append("g").attr("class", "t-name-container").each(function(d) {
            var i;

            for (i = 0; i < d.names.length; i++) {
                d3.select(this).append("text").append("tspan").text(d.names[i]).attr("y", i * margins.tNameGapY).each(wrap);
            }
        });

        nodeEntries.append("g").attr("class","stack-container").each(
            function(d) {
                var stacks = d.stacks;
                var i, txtNode, j;
                for (i = 0; i < stacks.length; i++) {
                    for (j = 0; j < stacks[i].length; j++) {
                        d3.select(this).append("rect").attr("y", Math.floor(j/3) * margins.tNameGapY - 15).attr("x", (((j % 3) + 0.95) * (margins.stackNameGap + margins.stackNameWidth))).attr("height", 20).style("fill", "grey").attr("width", margins.stackNameWidth);
                        txtNode = d3.select(this).append("text").append("tspan").text(extractMethodName(stacks[i][j])).attr("x", (((j % 3) + 1) * (margins.stackNameGap + margins.stackNameWidth))).attr("y", Math.floor(j/3) * margins.tNameGapY).each(wrap);
                    }
                }
            });

        nodeEntries.append("line").attr("y1", -20).attr("y2", -20).attr("stroke", "black").attr("x1", 0).attr("x2", width);
        
    }
});
