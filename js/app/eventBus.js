define([], function() {
    // Instead of writing a custom event target or implementing the actual event handling, am piggy backing on an actual event target delegate, so I queue all the events till delegate is set and replay them when it is set, same thing with listeners. This does mean that till delegate is set, none of the listeners will fire, but hey! laziness only takes you so far
    var eventBus = {
        listeners : [],
        delegate : null,
        pendingEvents : [],
        emit : function(eventType, data) {
            var event = new CustomEvent(eventType, {'detail' : data});
            if (this.delegate) {
                this.delegate.dispatchEvent(event);
            } else {
                this.pendingEvents.push(event);
            }
        },
        on :function(eventType, listener) {
            if (this.delegate) {
                this.delegate.addEventListener(eventType, listener);
            } else {
                this.listeners.push({'name':eventType, 'callback':listener});
            }
        },
        setDelegate : function(newDelegate) {
            var i = 0, listener;
            if (this.delegate) {
                throw new Error("delegate on event bus once set can not be changed");
            } else {
                this.delegate = newDelegate;
                // move listeners to the actual delegate
                for (i = 0; i < this.listeners.length; i++) {
                    listener = this.listeners[i];
                    this.delegate.addEventListener(listener.name, listener.callback);
                }

                //replay all pending events now
                while(this.pendingEvents.length) {
                    this.delegate.dispatchEvent(this.pendingEvents.pop());
                }
            }
        }
    };

    return eventBus;
});
