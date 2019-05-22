define([], function() {
    var transformers = {
    };

    function register(cmdName, transformer) {
        transformers[cmdName] = transformer;
    }

    function transform(cmdName, data) {
        if (transformers[cmdName]) {
            return transformers[cmdName].call(this, data);
        } else {
            return data;
        }
    }
    return {
        register: register,
        transform: transform
    }
});
