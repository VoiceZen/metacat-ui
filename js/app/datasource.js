define(["promise", "jquery"], function(Promise, $) {

    function rawFetch(url, data, httpVerb, promiseHolder) {
        return $.ajax({
            beforeSend: function(xhrObj){
                xhrObj.setRequestHeader("Content-Type","application/json");
                xhrObj.setRequestHeader("Accept","application/json");
            },
            type: httpVerb || "POST",
            url: url,
            processData: false,
            data: (data)? JSON.stringify(data):null, 
            dataType: "json"
        }).done(function(responseData){
            promiseHolder.fulfill(responseData);
        });        
    }

    function fetch(url, data, httpVerb, promiseHolder) {
        return rawFetch(url, data, httpVerb, promiseHolder)
            .fail(function(jqXHR, textStatus, errorThrown) {
                promiseHolder.reject(errorThrown);
            });
    }

    function retryingFetch(url, data, httpVerb, promiseHolder) {
        return rawFetch(url, data, httpVerb, promiseHolder)
            .fail(function(jqXHR, textStatus, errorThrown) {
                var retryCounter = promiseHolder.retryCounter;
                retryCounter = (retryCounter)? retryCounter + 1 : 1;
                if (retryCounter < 5) {
                    setTimeout(retryingFetch, 300 * retryCounter * retryCounter, url, data,httpVerb, promiseHolder);
                } else {
                    promiseHolder.reject(errorThrown);
                }
                promiseHolder.retryCounter = retryCounter;
            });
    }

    return {
        forJSON: function(url, data, verb, retry) {
            var promise = new Promise(function(fulfill, reject) {
                var fetchingMethod = (retry)? retryingFetch:fetch;
                verb = verb || "GET";
                fetchingMethod.call(this, url, data, verb, {"fulfill":fulfill, "reject":reject});
            });
            return promise;
        }
    };
});
