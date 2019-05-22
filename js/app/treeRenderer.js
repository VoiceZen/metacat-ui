define(["d3"], function(d3) {
    var sampleData;

    var margin = {top: 30, right: 20, bottom: 30, left: 20},
        width = 960 - margin.left - margin.right,
        barHeight = 20,
        barWidth = width * 0.8;

    var i = 0,
        duration = 400,
        root, svg;

    var tree = d3.layout.tree()
        .nodeSize([0, 20]);

    var line = d3.svg.line()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        })
        .interpolate("step-before");

    function plot(selector, dataSet) {
        if (dataSet && dataSet.children && dataSet.children.length > 0) {
            if (!(root)) {
                //reset whatever was present
                $(selector).html("");

                root = dataSet;
                svg = d3.select(selector).append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                root.x0 = 0;
                root.y0 = 0;
                // collapse all nodes, sub-optimal
                tree.nodes(root).forEach(function(node){toggle(node);});
                //expand root
                toggle(root);
            } else {
                root = mergeWithExisting(dataSet, root);
            }
            update(root);
        }
    }

    function mergeWithExisting(delta, original) {
        var childDelta = delta.children, i, deltaThreadNode, threadNode, deltaChildren, j, deltaNode;
        // you complete me
        var dictionary = createDictionary(original);
        for (i = 0; i < childDelta.length; i++) {
            deltaThreadNode = childDelta[i];
            threadNode = dictionary[deltaThreadNode.tId];
            deltaChildren = deltaThreadNode.children;
            // iterate through child
            for (j = 0; j < deltaChildren.length; j++) {
                // can be optimized better as any node that does not need merge is succeeded by similar nodes
                deltaNode = deltaChildren[j];
                if (threadNode) {
                    if (deltaNode.needsMerge) {
                        mergePaths(deltaNode, threadNode);
                    } else {
                        threadNode.addChild(deltaNode);
                    }
                } else {
                    original.addChild(deltaThreadNode);
                }
                toggle(deltaNode);
            }
        }
        return original;
    }

    function createDictionary(node) {
        var dictionary = {}, i, child;
        var children;
        // we do some magic for UI display, so revert that
        if (node.children == null) {
            toggle(node);
        }
        children = node.children;
        for (i = 0; i < children.length; i++) {
            child = children[i];
            dictionary[child.tId] = child;
            if (child.children == null) {
                toggle(child);
            }
        }
        return dictionary;
    }

    function mergePaths(deltaChain, originalChain) {
        var originalChainChildren = (originalChain.children)? originalChain.children : originalChain._children;
        var lastChildInOrginalChain = originalChainChildren[originalChainChildren.length - 1];
        if (lastChildInOrginalChain.completed) {
            console.log("Problems with reconciliation "+lastChildInOrginalChain);
        } else {
            // find last node in deltaChain that needs merge
            providerChain = findLastChildChain(deltaChain, function(node){return node.needsMerge;});
            // find last node in originalChain that needs completion
            needyChain = findLastChildChain(lastChildInOrginalChain, function(node) {return !(node.completed);});

            // start merging from these point onwards
            mergeChains(providerChain, needyChain);
        }
        
    }
    
    function findLastChildChain(node, filter, parentChain) {
        var children = (node.children)? node.children: node._children, lastChild, addMe = false;
        parentChain = parentChain || [];
        if (children && children.length > 0 ) {
            lastChild = children[children.length - 1];
            if (filter(lastChild)) {
                parentChain.push(node);
                return findLastChildChain(lastChild, filter, parentChain);
            } else {
                addMe = true;
            }
        } else {
            addMe = true;
        }
        if (addMe) {
            parentChain.push(node);
            return parentChain;
        }
    }
    
    function mergeChains(deltaChain, originalChain) {
        var i, origNode, deltaNode, origNodeChildren;
        for (i = 0; i < deltaChain.length; i++) {
            deltaNode = deltaChain[i];
            origNode = originalChain[i];
            origNodeChildren = (origNode.children)? origNode.children:origNode._children;
            origNodeChildren.push.apply(origNodeChildren, getNonMergingChildren(deltaNode.children));
            origNode.totalTime = deltaNode.tstamp - origNode.tstamp;
            origNode.completed = true;
        }
    }

    function getNonMergingChildren(children) {
        if (children && children.length > 0) {
            if (children[0].needsMerge) {
                return children.splice(0,1);
            }
        } 
        return [];
    }

    function getDisplayName(name) {
        try {
            var nameList = name.split("(");
            var methodName = nameList[0];
            var expression = ".";
            var firstPoint = methodName.lastIndexOf(expression);
            var secondPoint = methodName.lastIndexOf(expression, firstPoint - 1);
            var packageName = methodName.substring(0, secondPoint);
            var exp = new RegExp("[a-zA-z0-9\$]*\.", "g");
            var pkgAbbr = packageName.match(exp).map(function (str) {
                return str.charAt(0) + ".";
            }).join("");
            return pkgAbbr + methodName.substring(secondPoint + 1) + "(" + nameList[1];
        }catch(e) {
            // in case of parsing errors, just use the name
            return name;
        }
    }

    function update(source) {

        var nodes = tree.nodes(root);
        var height = Math.max(500, nodes.length * barHeight + margin.top + margin.bottom);

        d3.select("svg").transition()
            .duration(duration)
            .attr("height", height);

        d3.select(self.frameElement).transition()
            .duration(duration)
            .style("height", height + "px");

        // Compute the "layout".
        nodes.forEach(function (n, i) {
            n.x = i * barHeight;
        });

        // Update the nodes
        var node = svg.selectAll("g.node")
            .data(nodes, function (d) {
                return d.id || (d.id = ++i);
            });

        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .style("opacity", 1e-6);

        // Enter any new nodes at the parent's previous position.
        nodeEnter.append("rect")
            .attr("y", -barHeight / 2)
            .attr("height", barHeight)
            .attr("width", barWidth)
            .style("fill", color)
            .on("click", click);

        nodeEnter.append("text")
            .attr("dy", 3.5)
            .attr("dx", 5.5)
            .text(function (d) {
                return getDisplayName(d.methodName) + ((d.completed)? d.totalTime:" o..");
            });

        // Transition nodes to their new position.
        nodeEnter.transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            })
            .style("opacity", 1);

        node.transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            })
            .style("opacity", 1)
            .select("rect")
            .style("fill", color);

        // Transition exiting nodes to the parent's new position.
        node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .style("opacity", 1e-6)
            .remove();

        // Update the links
        var link = svg.selectAll("path.link")
            .data(tree.links(nodes), function (d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function (d) {
                return getPoints(d);
            })
            .transition()
            .duration(duration)
            .attr("d", function(d){
                return getPoints(d);
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", function(d){
                return getPoints(d);
            });

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                return getPoints(d);
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });


    }

    function getPoints(d){
        var points = [
            {x: d.source.y, y: d.source.x},
            {x: d.target.y, y: d.target.x}
        ];
        return line(points);
    }


    // Toggle children on click.
    function click(d) {
        toggle(d);
        update(d);
    }

    function toggle(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
    }

    function color(d) {
        return d._children ? "#3182bd" : d.children ? "#c6dbef" : "#fd8d3c";
    }

    return {
        render: plot,
        sampleData: sampleData
    };
});

// var data = data from sample.json
// data["OptionalTasks:1"].methodName = "org.apache.cassandra.Root.root()";
// var tr = require("app/treeRenderer");
// tr.render("body > .ui-layout-center > .data", data["OptionalTasks:1"])
// tr.render("body > .ui-layout-center > .data", createTree(data))

