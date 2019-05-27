define(["jquery", "app/eventBus", "app/renderers"], function ($, eventBus, renderer) {

    renderer.registerRenderer("table", plot);

    function plot(selector, dataSet) {
        var parent = $(selector);
        var summaryEl = $('<div>').addClass('well');
        var summaryDesc = JSON.stringify(dataSet.summary);
        summaryEl.html(summaryDesc)
        parent.append(summaryEl);
        addTable(parent, dataSet.rows);
    }


    function addTable(appendObj, list) {
        var table = $('<table>').addClass('table table-bordered');
        var columns = addAllColumnHeaders(list, table);

        for (var i = 0; i < list.length; i++) {
            var row$ = $('<tr/>');
            for (var colIndex = 0; colIndex < columns.length; colIndex++) {
                var cellValue = list[i][columns[colIndex]];

                if (cellValue == null) {
                    cellValue = "";
                }

                if (cellValue.constructor === Array) {
                    $a = $('<td/>');
                    row$.append($a);
                    addTable(cellValue, $a);

                } else if (cellValue.constructor === Object) {

                    var array = $.map(cellValue, function (value, index) {
                        return [value];
                    });

                    $a = $('<td/>');
                    row$.append($a);
                    addObject(array, $a);

                } else {
                    row$.append($('<td/>').html(cellValue));
                }
            }
            table.append(row$);
        }
        appendObj.append(table);

    }


    function addObject(list, appendObj) {
        for (var i = 0; i < list.length; i++) {
            var row$ = $('<tr/>');

            var cellValue = list[i];

            if (cellValue == null) {
                cellValue = "";
            }

            if (cellValue.constructor === Array) {
                $a = $('<td/>');
                row$.append($a);
                addTable(cellValue, $a);

            } else if (cellValue.constructor === Object) {

                var array = $.map(cellValue, function (value, index) {
                    return [value];
                });

                $a = $('<td/>');
                row$.append($a);
                addObject(array, $a);

            } else {
                row$.append($('<td/>').html(cellValue));
            }
            appendObj.append(row$);
        }
    }

    // Adds a header row to the table and returns the set of columns.
    // Need to do union of keys from all records as some records may not contain
    // all records
    function addAllColumnHeaders(list, appendObj) {
        var columnSet = [];
        var headerTr$ = $('<tr/>');

        for (var i = 0; i < list.length; i++) {
            var rowHash = list[i];
            for (var key in rowHash) {
                if ($.inArray(key, columnSet) == -1) {
                    columnSet.push(key);
                    headerTr$.append($('<th/>').html(key));
                }
            }
        }
        appendObj.append(headerTr$);

        return columnSet;
    }
    return {
        render: plot
    }

});