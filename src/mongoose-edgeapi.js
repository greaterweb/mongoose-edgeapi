'use strict';

// Node Modules
var querystring = require('querystring');

// 3rd Party Node Modules
var Q = require('q'),
    _ = require('underscore');

/**
 * Escape regular expression string
 * hat tip: http://stackoverflow.com/a/6969486/41903
 *
 * @param  {String} str string value
 * @return {String}     escaped string value
 */
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

/**
 * Default config used throughout the API instantiation and usage
 * @type {Object}
 */
exports.config = {
    /**
     * relative URL base for your REST services a value of /api/ will give you URLs that start with  mysite.com/api/
     * @type {String}
     */
    baseURL: '/api/',
    /**
     * default offset (aka, skip) value to be supplied in queries fetching collection documents
     * @type {Number}
     */
    queryOffset: 0,
    /**
     * default limit value to be supplied in queries fetching collection documents
     * @type {Number}
     */
    queryLimit: 0,
    /**
     * default value for query sorting
     * @type {Object}
     */
    querySort: {},
    /**
     * collection of fields to ignore when schema is being processed by getSchemaFields
     * @type {Array}
     */
    schemaFieldIgnore: ['__v'],
    /**
     * collection of JSON keys to ignore (aka, not discard) when processing the parameters in buildQueryFromParams
     * @type {Array}
     */
    queryOperatorIgnore: [
        // http://docs.mongodb.org/manual/reference/operator/
        //
        // Query and update operators
        //
        '$addToSet', '$all', '$and', '$bit', '$box', '$center', '$centerSphere',
        '$comment', '$each', '$elemMatch (query)', '$exists', '$explain', '$geoIntersects',
        '$geoWithin', '$geometry', '$gt', '$gte', '$hint', '$in', '$inc', '$isolated', '$lt',
        '$lte', '$max', '$maxDistance', '$maxScan', '$min', '$mod', '$natural', '$ne', '$near',
        '$nearSphere', '$nin', '$nor', '$not', '$or', '$orderby', '$polygon', '$pop',
        '$pull', '$pullAll', '$push', '$pushAll', '$query', '$regex', '$rename',
        '$returnKey', '$set', '$setOnInsert', '$showDiskLoc', '$size', '$slice', '$snapshot',
        '$sort', '$type', '$uniqueDocs', '$unset', '$where', // '$' handled differently
        //
        // Projection operators:
        //
        '$elemMatch', '$slice', // '$' handled differently
        //
        // Aggregation operators:
        //
        '$add', '$addToSet', '$and', '$avg', '$cmp', '$concat', '$cond', '$dayOfMonth',
        '$dayOfWeek', '$dayOfYear', '$divide', '$eq', '$first', '$geoNear', '$group', '$gt',
        '$gte', '$hour', '$ifNull', '$last', '$limit', '$lt', '$lte', '$match', '$max',
        '$millisecond', '$min', '$minute', '$mod', '$month', '$multiply', '$ne', '$not',
        '$or', '$project', '$push', '$second', '$skip', '$sort', '$strcasecmp', '$substr',
        '$subtract', '$sum', '$toLower', '$toUpper', '$unwind', '$week', '$year',
    ],
    /**
     * Collection of proprietary field modifiers that can be used in query param keys
     * example usage: somefield.contains=Some Value
     * @type {Array}
     */
    fieldModifiers: ['contains', 'regex'],
    /**
     * Process proprietary modifier value and return appropriate mongodb syntax
     * @param  {String} modifier modifier type
     * @param  {Sring|Object} value    value of query field
     * @return {String|Object}          mongodb appropriate value
     */
    processModifier: function (modifier, value) {
        var modiferValue = value,
            flags = '';
        switch (modifier) {
        case 'contains':
            modiferValue = { '$regex' : new RegExp(escapeRegExp(value)) };
            break;
        case 'regex':
            if (value.indexOf('/') === 0) {
                // expecting regex to be in format of /regex/flags
                value = value.split('/');
                flags = value[2] || flags;
                value = value[1];
            }

            modiferValue = { '$regex' : new RegExp(value, flags) };
            break;
        }
        return modiferValue;
    },
    /**
     * Serve JSON response to browser
     * @param  {Object} res    node http response object
     * @param  {Number} code   header response code
     * @param  {Object} object JSON data to be sent in response
     * @return {Object}        JSON data sent in response
     */
    serveJson: function (res, code, object) {
        // http://en.wikipedia.org/wiki/Cross-origin_resource_sharing
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'X-Requested-With'
        });
        res.json(code, object);
        return object;
    },
    /**
     * Server JSON response error to browser
     * @param  {Object} res   node http response object
     * @param  {Object} [error={}] error object containing message to be sent in response
     * @return {objebt}       error object
     */
    serveError: function (res, error) {
        var config = this;
        error = error || {};
        config.serveJson(res, 500, {
            message: error.message || 'Unknown error.'
        });
        return error;
    },
    /**
     * Recursive function to get a list of fields from the mongoose schema.
     * Nested fields will be represented in dot notation eg. field.child
     * @param  {Object} schema  mongoose schema
     * @param  {Array} [fields=[]]  collection of fields to start with
     * @param  {String} [context=''] context of current schema keys in dot notation
     * @return {Array}         list of fields from mongoose schema excluding ignored fields
     */
    getSchemaFields: function (schema, fields, context) {
        var config = this,
            paths = schema.paths,
            field;

        fields = fields || [];
        context = context || '';

        _.each(paths, function (value, key) {
            if (!~config.schemaFieldIgnore.indexOf(key)) {
                field = (context) ? [context, key].join('.') : key;
                if (value.caster) {
                    // for Array values or Sub Documents
                    fields.push(field + '.$');
                }

                if (value.schema) {
                    config.getSchemaFields(value.schema, fields, field);
                    // for Sub Documents
                    config.getSchemaFields(value.schema, fields, field + '.$');
                }
                return fields.push(field);
            }
        });
        return fields;
    },
    /**
     * Get a list of fields from the mongoose schema virtual fields
     * @param  {Object} schema mongoose schema
     * @param  {Array} [fields=[]] collection of fields to start with
     * @return {Array}        list of fields from mongoose schema virtual fields excluding ignored fields
     */
    getVirtualFields: function (schema, fields) {
        var config = this,
            virtuals = schema.virtuals;

        fields = fields || [];
        _.each(virtuals, function (value, key) {
            if (!~config.schemaFieldIgnore.indexOf(key)) {
                return fields.push(key);
            }
        });
        return fields;
    },
    /**
     * Build projection object from a string of collection fields
     * @param  {String} fields specially formatted list of projection fields
     * @return {Ojbect}        mongodb formatted projection
     */
    buildProjectionFromString: function (fields) {
        var projection = {};
        _.each(fields.split(','), function (value) {
            if (~value.indexOf(':')) {
                var field = value.split(':');
                projection[field[0]] = field[1];
            } else {
                projection[value] = 1;
            }
        });
        return projection;
    },
    /**
     * Recursive function to build query params comparing param key to a list of approved fields
     * Nested params will be represented in dot notation eg. field.child
     * @param  {Object} params  all query parameters
     * @param  {Array} fields  collection of acceptable key names
     * @param  {String} [context=''] context of current param keys in dot notation
     * @return {Object}         sanitized list of query parameters
     */
    buildQueryFromParams: function (params, fields, context) {
        var config = this,
            field;

        if (!_.isObject(params)) {
            return params;
        }

        context = context || '';
        _.each(params, function (value, key, params) {
            field = (context) ? [context, key].join('.') : key;

            // Factoring for GET parameters which make use of the
            // proprietary modifier naming conventions
            if (Number(key) !== key) {
                var modifierKey = key.split('.'),
                    modifier = modifierKey.pop();
                if (~_.indexOf(config.fieldModifiers, modifier)) {
                    delete params[key];
                    value = config.processModifier(modifier, value);
                    key = modifierKey.join('.');
                    params[key] = value;
                }
            }

            if (Number(key) === key) {
                // This comes into play when you are posting a collection of
                // sub documents
                params[key] = config.buildQueryFromParams(value, fields, context);
            } else if ('object' === typeof value) {
                if (~_.indexOf(config.queryOperatorIgnore, key)) {
                    // use previous context if key is in query operators array
                    params[key] = config.buildQueryFromParams(value, fields, context);
                } else {
                    params[key] = config.buildQueryFromParams(value, fields, field);
                }
            } else if (!~_.indexOf(fields, field) && !~_.indexOf(config.queryOperatorIgnore, key)) {
                delete params[key];
            }
        });
        return params;
    },
    /**
     * Authenticate user ensuring they are permitted to access API
     * @param  {Object} req http request object
     * @param  {Object} res http response object
     * @param  {Function} next function to move to next route handler
     * @return {Object}     next or response object
     */
    authenticateUser: function (req, res, next) {
        // TODO: Build authentication logic
        next();
    },
    /**
     * Validate the document ID as a valid ObjectID
     * @param  {String}  id string representation of mongodb objectid
     * @return {Boolean}
     */
    isValidId: function (id) {
        var checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
        return checkForHexRegExp.test(id);
    },
    /**
     * Calculate the query offset based on results per page and page Number
     * @param  {Number} pageNum        Page number
     * @param  {Number} resultsPerPage Results to display per page
     * @return {Number}                Document offset for query
     */
    calculateDocumentOffset: function (pageNum, resultsPerPage) {
        return (pageNum >= 0) ? ((pageNum - 1) * resultsPerPage) : 0;
    },
    crud: function (Model) {

        var config = this,
            fields = _.union(config.getSchemaFields(Model.schema), config.getVirtualFields(Model.schema)),
            crud = {};

        /**
         * mongoose Model
         * @type {Object}
         */
        crud.Model = Model;

        /**
         * Save document to Mongo collection using Mongoose create method
         * @param  {Object} document JSON object to be inserted into collection
         * @return {Object}          Q promise resolving to save results
         */
        crud.save = function (document) {
            var deferred = Q.defer();
            try {
                crud.Model.create(document, function (error, model) {
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(model);
                    }
                });
            } catch (error) {
                deferred.reject(error);
            }
            return deferred.promise;
        };

        /**
         * Find alias
         * @type {Function}
         */
        crud.create = crud.save;

        /**
         * Find document(s) in mongodb collection using Mongoose find method
         * @param  {Object} [query={}] query for Mongoose find method
         * @param  {Object} [projection={}] projection object passed to query
         * @return {Object}          Q promise resolving to find results
         */
        crud.find = function (query, limit, sort, projection, pageNum) {
            var deferred = Q.defer();

            limit = limit || config.queryLimit;
            sort = sort;
            projection = projection || {};
            query = crud.Model.find(query, projection);

            if (!sort) {
                sort = config.querySort;
            } else {
                var sortParams = sort.split(',');
                sort = {};
                sortParams.forEach(function (param) {
                    param = param.split(':');
                    sort[param[0]] = param[1];
                });
                sort = config.buildQueryFromParams(sort, fields);
            }

            var offset = config.calculateDocumentOffset(pageNum, limit) || config.queryOffset;
            query
                .skip(offset)
                .limit(limit)
                .sort(sort)
                .exec(function (error, documents) {
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(documents);
                    }
                });
            return deferred.promise;
        };

        /**
         * Find document(s) in mongodb collection by _id using Mongoose findById method
         * @param  {Objectid} id mongodb id in string format
         * @param  {Object} [projection={}] projection object passed to query
         * @return {Object}          Q promise resolving to find results
         */
        crud.findById = function (id, projection) {
            var deferred = Q.defer();
            projection = projection || {};
            crud.Model.findById(id, projection, function (error, documents) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(documents);
                }
            });
            return deferred.promise;
        };

        /**
         * Update document in mongodb collection by _id using mongoose update method
         * @param  {Object} query     mongodb query
         * @param  {Object} updates document updates
         * @return {Object}          Q promise resolving to findByIdAndUpdate results
         */
        crud.update = function (query, updates) {
            var deferred = Q.defer();
            crud.Model.update(query, updates, { multi: true }, function (error, update) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(update);
                }
            });
            return deferred.promise;
        };

        /**
         * Remove document(s) in mongodb collection using Mongoose remove method
         * @param  {Object} query query for Mongoose remove method
         * @return {Object}       Q promise resolving to removed results
         */
        crud.remove = function (query) {
            var deferred = Q.defer();
            crud.Model.remove(query, function (error, removed) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(removed);
                }
            });
            return deferred.promise;
        };

        /**
         * Remove alias
         * @type {Object}
         */
        crud.delete = crud.remove;

        /**
         * Count documents in mongodb collection based on query using Mongoose count method
         * @param  {Object} query Mongoose query
         * @return {Object}       Q promise resolving to count results
         */
        crud.count = function (query) {
            var deferred = Q.defer();
            query = query || {};
            crud.Model.count(query, function (error, count) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(count);
                }
            });
            return deferred.promise;
        };

        /**
         * Get a distinct collection of fields from mongoose collection based on the input query
         * @param  {String} select field to select
         * @param  {Object} query  Mongoose query
         * @return {Object}        Q promise resolving to distinct results
         */
        crud.distinct = function (select, query) {
            var deferred = Q.defer();
            select = select || '';
            query = query || {};
            crud.Model.distinct(select, query, function (error, distinct) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(distinct);
                }
            });
            return deferred.promise;
        };

        /**
         * Aggregate $group query
         * @param  {Object} group $group value for aggregate query
         * @return {Object}       Q promise resolving to group resutls
         */
        crud.group = function (group) {
            var deferred = Q.defer();
            crud.Model.aggregate({'$group': group}, function (error, group) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(group);
                }
            });
            return deferred.promise;
        };

        /**
         * Aggregate query
         * @param  {Object} aggregate aggregate query for mongoose
         * @return {Ojbect}           Q promise resolving to aggregate results
         */
        crud.aggregate = function (aggregate) {
            var deferred = Q.defer();
            crud.Model.aggregate(aggregate, function (error, aggregate) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(aggregate);
                }
            });
            return deferred.promise;
        };

        /**
         * Build collection meta data to send back with REST response
         * @param  {String} path   Route path currently in use
         * @param  {Object} params http req.query parameters
         * @param  {Object} query  query used in Mongoose find
         * @return {Object}        Q promise resolving to collection meta data
         */
        crud.buildResultsMeta = function (path, params, query) {
            var deferred = Q.defer(),
                limit = parseInt(params.limit || config.queryLimit, 10),
                offset = parseInt(params.offset || config.queryOffset, 10),
                page = parseInt(params.page || 1, 10),
                meta = {
                    documents: 0,
                    pages: 0,
                    limit: limit,
                    offset: offset,
                    links: {
                        first: (path) ? '' : {},
                        prev: (path) ? '' : {},
                        next: (path) ? '' : {},
                        last: (path) ? '' : {}
                    }
                };

            var first = _.extend({}, params); // clone params
            first.page = 1;
            meta.links.first = (path) ? path + '?' + querystring.stringify(first) : first;

            if (page > 1) {
                var previous = _.extend({}, params); // clone params
                previous.page = page - 1;
                meta.links.prev = (path) ? path + '?' + querystring.stringify(previous) : previous;
            }

            crud.count(query).then(
                function onFulfilled(count) {
                    meta.documents = count;
                    meta.pages = (count && limit > 0) ? Math.ceil(count / limit) : 1;

                    if (limit > 0 && count > (page * limit)) {
                        var next = _.extend({}, params); // clone params
                        next.page = page + 1;
                        meta.links.next = (path) ? path + '?' + querystring.stringify(next) : next;
                    }

                    var last = _.extend({}, params); // clone params
                    last.page = meta.pages;
                    meta.links.last = (path) ? path + '?' + querystring.stringify(last) : last;

                    deferred.resolve(meta);
                },
                function onRejected(error) {
                    meta.documents = error;
                    deferred.resolve(meta); //intentional to treat as a resolve
                });

            return deferred.promise;
        };

        return crud;
    }
};

/**
 * Abstracted socket events mapped to CRUD methods
 * @param  {string} model      descriptor of collection model
 * @param  {object} socket     socket.io web socket connection
 * @param  {object} crud       CRUD wrapper instantiated with mongojs collection
 * @return {object}            CRUD socket object
 */
exports.serveSockets = function (socket, Model, config) {

    config = _.extend(exports.config, config || {});

    var collection = Model.collection,
        fields = _.union(config.getSchemaFields(Model.schema), config.getVirtualFields(Model.schema)),
        crud = config.crud(Model);

    var sockets = {};

    /**
     * Descriptor of collection name used in events
     * @type {string}
     */
    sockets.collection = collection.name;

    /**
     * CRUD wrapper instantiated with mongojs collection
     * @type {object}
     */
    sockets.crud = crud;

    /**
     * socket.io socket connection
     * @type {object}
     */
    sockets.socket = socket;

    /**
     * Property instantiating save socket connection
     * @type {object}
     */
    sockets.save = sockets.socket.on('api.' + sockets.collection + '.save',
        /**
         * Create document in Model collection from data sent to socket event listener
         * @param  {Object} params Document to add to collection
         * @return {Object}        Q promise resolving to document save results
         */
        function saveDocument(params) {
            params = params || {};
            var document = config.buildQueryFromParams(params, fields);
            return sockets.crud.save(document).then(
                function onSaveFulfilled(document) {
                    sockets.socket.emit('api.' + sockets.collection + '.save.response', {
                        message: 'Resource created',
                        document: document
                    });
                },
                function onSaveRejected(error) {
                    sockets.socket.emit('api.' + sockets.collection + '.save.error', {
                        message: error
                    });
                });
        });

    /**
     * Property instantiating find socket connection
     * @type {object}
     */
    sockets.find = sockets.socket.on('api.' + sockets.collection + '.find',
        /**
         * Find document(s) in Model collection based on query parameters sent to socket event listener
         * @param  {Object} params Query parameters
         * @return {Object}        Q promise resolving to document find results
         */
        function findDocuments(params) {
            params = params || {};
            var query = config.buildQueryFromParams(_.extend({}, params), fields),
                limit = params.limit,
                pageNum = params.page,
                sort = params.sort,
                projection = params.projection,
                id = params.id || params._id;

            if (id) {
                query._id = id;
            }

            return sockets.crud.find(query, limit, sort, projection, pageNum).then(
                function onFulfilled(documents) {
                    documents = { documents: documents };
                    sockets.crud.buildResultsMeta(false, params, query).then(
                        function onFulfilled(meta) {
                            documents.meta = meta;
                            sockets.socket.emit('api.' + sockets.collection + '.find.response', documents);
                        });
                },
                function onRejected(error) {
                    sockets.socket.emit('api.' + sockets.collection + '.find.error', {
                        message: error
                    });
                });
        });

    /**
     * Property instantiating update socket connection
     * @type {object}
     */
    sockets.update = sockets.socket.on('api.' + sockets.collection + '.update',
        /**
         * Update document in Model collection based on query parameters sent to socket event listener
         * @param  {Object} params Object containing id and document updates
         * @return {Object}        Q promise resolving to document update results
         */
        function updateDocument(params) {
            params = params || {};
            var document = config.buildQueryFromParams(_.extend({}, params), fields),
                query = config.buildQueryFromParams(_.extend({}, params._query), fields),
                id = params.id || params._id;

            if (_.isEmpty(query)) {
                query = { _id: id };
            }

            return crud.update(query, document).then(
                function onFulfilled(update) {
                    if (update) {
                        sockets.socket.emit('api.' + sockets.collection + '.update.response', {
                            message: 'Resources updated',
                            update: update
                        });
                    } else {
                        sockets.socket.emit('api.' + sockets.collection + '.update.response', {
                            message: 'Resource not found'
                        });
                    }
                },
                function onRejected(error) {
                    sockets.socket.emit('api.' + sockets.collection + '.update.error', {
                        message: error
                    });
                });
        });

    /**
     * Property instantiating delete socket connection
     * @type {object}
     */
    sockets.delete = sockets.socket.on('api.' + sockets.collection + '.delete',
        function deleteDocuments(params) {
            params = params || {};
            var query = config.buildQueryFromParams(_.extend({}, params), fields),
                id = params.id || params._id;
            // add _id back in where appropriate
            if (id) {
                query._id = id;
            }
            return crud.remove(query).then(
                function onFulfilled(removed) {
                    sockets.socket.emit('api.' + sockets.collection + '.update.response', {
                        message: 'Resources deleted',
                        removed: removed
                    });
                },
                function onRejected(error) {
                    sockets.socket.emit('api.' + sockets.collection + '.update.response', {
                        message: error
                    });
                });
        });

    return sockets;

};

exports.serveRoutes = function (app, Model, config) {

    config = _.extend(exports.config, config || {});

    var collection = Model.collection,
        routePath = config.baseURL + collection.name,
        idRoutePath = routePath + '/:id',
        aggregationRoutePath = routePath + '/:aggregation',
        projectionRoutePath = idRoutePath + '/:projection',
        fields = _.union(config.getSchemaFields(Model.schema), config.getVirtualFields(Model.schema)),
        crud = config.crud(Model);

    console.log('\nSetting up route handlers...');
    console.log('\tPOST \t->', routePath);
    // POST create dcoument
    app.post(routePath,
        config.authenticateUser,
        /**
         * Create document in Model collection from data POSTed to routePath,
         * also factors url parameters as part of the document
         * @param  {Object}   req  http request object
         * @param  {Object}   res  http response object
         * @return {Object}        Q promise resolving to create method response
         */
        function createDocument(req, res) {
            // req.body expected to be of the following content types for bodyParser to work:
            // application/json, application/x-www-form-encoded or multipart/form-data
            //
            // we will also accept URL parameters and include them into the mix
            var params = _.extend(req.query || {}, req.body || {});
            var document = config.buildQueryFromParams(params, fields);

            var create = crud.create(document);
            create.then(
                function onFulfilled(document) {
                    config.serveJson(res, 201, {
                        message: 'Resource created',
                        document: document
                    });
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return create;
        });

    console.log('\tGET \t->', routePath);
    // GET find document(s)
    app.get(routePath,
        config.authenticateUser,
        /**
         * Get all documents in Model collection matching basic query parameters, if none supplied all
         * documents are returend. complex query parameters are not supported eg.
         * @param  {Object}   req  http request object
         * @param  {Object}   res  http response object
         * @return {Object}        Q promise resolving to find method response
         */
        function findDocuments(req, res) {
            // TODO: Apply this sort of logic in other areas or wrap as helper method
            try {
                if (req.query._query) {
                    var rawQuery = JSON.parse(req.query._query);
                    req.query = _.extend(rawQuery, req.query);
                    delete req.query._query;
                }
            } catch (error) {
                config.serveError(res, {
                    message: 'Unable to parese query string as JSON'
                });
            }

            var params =  _.extend({}, req.query || {}),
                query = config.buildQueryFromParams(params, fields),
                limit = req.query.limit,
                pageNum = req.query.page,
                sort = req.query.sort;

            var find = crud.find(query, limit, sort, {}, pageNum);
            find.then(
                function onFulfilled(documents) {
                    documents = { documents: documents };
                    crud.buildResultsMeta(req.route.path, req.query, query).then(
                        function onFulfilled(meta) {
                            documents.meta = meta;
                            config.serveJson(res, 200, documents);
                        });
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return find;
        });

    console.log('\tPUT \t->', routePath);
    // PUT update without id, not permitted for now
    app.put(routePath,
        config.authenticateUser,
        /**
         * Update PUT document(s) in Model collection
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     JSON response message passed to config.serveJson
         */
        function updateDocuments(req, res) {
            // req.body expected to be of the following content types for bodyParser to work:
            // application/json, application/x-www-form-encoded or multipart/form-data
            //
            // we will also accept URL parameters and include them into the mix
            var query = config.buildQueryFromParams(_.extend({}, req.query || {}), fields);
            var document = config.buildQueryFromParams(_.extend({}, req.body || {}), fields);

            var update = crud.update(query, document);
            update.then(
                function onFulfilled(update) {
                    if (update) {
                        config.serveJson(res, 200, {
                            message: 'Resources updated',
                            update: update
                        });
                    } else {
                        config.serveJson(res, 404, {
                            message: 'Resources not found'
                        });
                    }
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return update;
        });

    console.log('\tDELETE \t->', routePath);
    // DELETE delete all records, better be sure you want to do this!
    app.delete(routePath,
        config.authenticateUser,
        /**
         * Delete all documents from Model collection matching query,
         * be careful all documents can be deleted if no query is supplied
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     Q promise resolving to remove method response
         */
        function deleteDocuments(req, res) {
            // req.body expected to be of the following content types for bodyParser to work:
            // application/json, application/x-www-form-encoded or multipart/form-data
            //
            // we will also accept URL parameters and include them into the mix
            var params = _.extend(req.query || {}, req.body || {});
            var query = config.buildQueryFromParams(params, fields);

            var remove = crud.remove(query);
            remove.then(
                function onFulfilled(removed) {
                    config.serveJson(res, 200, {
                        message: 'Resources deleted',
                        removed: removed
                    });
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return remove;
        });

    console.log('\tGET \t->', aggregationRoutePath);
    app.get(aggregationRoutePath,
        config.authenticateUser,
        /**
         * Route handler for count, distinct, group and aggregate Mongoose queries
         * @param  {Object}   req  http request object
         * @param  {Object}   res  http response object
         * @param  {Function} next express function to advance to the next route handler
         * @return {Object}
         */
        function postAggregationQuery(req, res, next) {
            // advance REST usage, baased on the aggregation type different
            // query parameters are expected
            // JSON.stringify() should be used when building query parameters
            var params = _.extend(req.query || {});
            _.forEach(params, function (param, key) {
                try {
                    params[key] = JSON.parse(param);
                } catch (e) {
                    params[key] = param;
                }
            });

            switch (req.params.aggregation) {
            case 'count':
                return crud.count(config.buildQueryFromParams(params.query, fields)).then(
                    function onFulfilled(results) {
                        config.serveJson(res, 200, {
                            count: results
                        });
                    },
                    function onRejected(error) {
                        config.serveError(res, error);
                    });
            case 'distinct':
                return crud.distinct(params.select, config.buildQueryFromParams(params.query, fields)).then(
                    function onFulfilled(results) {
                        config.serveJson(res, 200, {
                            distinct: results
                        });
                    },
                    function onRejected(error) {
                        config.serveError(res, error);
                    });
            case 'group':
                return crud.group(config.buildQueryFromParams(params.group, fields)).then(
                    function onFulfilled(results) {
                        config.serveJson(res, 200, {
                            group: results
                        });
                    },
                    function onRejected(error) {
                        config.serveError(res, error);
                    });
            case 'aggregate':
                return crud.aggregate(config.buildQueryFromParams(params.aggregate, fields)).then(
                    function onFulfilled(results) {
                        config.serveJson(res, 200, {
                            aggregate: results
                        });
                    },
                    function onRejected(error) {
                        config.serveError(res, error);
                    });
            default:
                return next();
            }
        });

    console.log('\tPOST \t->', idRoutePath);
    // POST document by route :id, not supported
    app.post(idRoutePath,
        config.authenticateUser,
        /**
         * POST Model collection document by route :id, not a supported method
         * @param  {Object} req http request handler
         * @param  {Object} res http response handler
         * @return {Object}     JSON response message passed to config.serveJson
         */
        function postDocumentById(req, res) {
            return config.serveJson(res, 405, {
                message: 'Posting to a resource is not supported, use PUT for updates and POST to index for creating new documents'
            });
        });

    console.log('\tGET \t->', routePath + '/:projection');
    // GET documents using :projection
    app.get(routePath + '/:projection',
        config.authenticateUser,
        /**
         * Get Model collection documents using :projection
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @param  {Function} next  http function moving to next route handler
         * @return {Object}     Q promise that resolves to findById method response
         */
        function getDocumentByFields(req, res, next) {
            if (!config.isValidId(req.params.projection)) {
                var params =  _.extend({}, req.query || {}),
                    query = config.buildQueryFromParams(params, fields),
                    limit = req.query.limit,
                    pageNum = req.query.page,
                    sort = req.query.sort;

                var projection = config.buildProjectionFromString(req.params.projection);

                var find = crud.find(query, limit, sort, projection, pageNum);
                find.then(
                    function onFulfilled(documents) {
                        documents = { documents: documents };
                        crud.buildResultsMeta(req.url, req.query, query).then(
                            function onFulfilled(meta) {
                                documents.meta = meta;
                                config.serveJson(res, 200, documents);
                            });
                    },
                    function onRejected(error) {
                        config.serveError(res, error);
                    });
                return find;
            }
            return next();
        });

    console.log('\tGET \t->', idRoutePath);
    // GET document by route :id
    app.get(idRoutePath,
        config.authenticateUser,
        /**
         * Get Model collection document by route :id
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     Q promise that resolves to findById method response
         */
        function getDocumentById(req, res) {
            var find = crud.findById(req.params.id);
            find.then(
                function onFulfilled(document) {
                    if (document) {
                        config.serveJson(res, 200, document);
                    } else {
                        config.serveJson(res, 404, {
                            message: 'Resource not found'
                        });
                    }
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return find;
        });

    console.log('\tPUT \t->', idRoutePath);
    // PUT document update by route :id
    app.put(idRoutePath,
        config.authenticateUser,
        /**
         * Update Model collection document by id
         * @param  {Object}   req  http request object
         * @param  {Object}   res  http response object
         * @return {Object}        Q promise that resolves to update method response
         */
        function updateDocumentById(req, res) {
            // req.body expected to be of the following content types for bodyParser to work:
            // application/json, application/x-www-form-encoded or multipart/form-data
            //
            // we will also accept URL parameters and include them into the mix
            var params = _.extend(req.query || {}, req.body || {});
            var document = config.buildQueryFromParams(params, fields);

            // TODO: quick fix to eliminate Modon_idnotallowed error, need to examine if _id and id should be excluded from fields
            delete document._id;
            delete document.id;

            var update = crud.update({ _id: req.params.id}, document);
            update.then(
                function onFulfilled(update) {
                    if (update) {
                        config.serveJson(res, 200, {
                            message: 'Resources updated',
                            update: update
                        });
                    } else {
                        config.serveJson(res, 404, {
                            message: 'Resource not found'
                        });
                    }
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return update;
        });

    console.log('\tDELETE \t->', idRoutePath);
    // DELETE document by route :id
    app.delete(idRoutePath,
        config.authenticateUser,
        /**
         * Delete Model collection document by route id
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     Q promise that resolves to remove method response
         */
        function deleteDocumentById(req, res) {
            var remove = crud.remove({ _id: req.params.id });
            remove.then(
                function onFulfilled(removed) {
                    if (removed) {
                        config.serveJson(res, 200, {
                            message: 'Resources deleted',
                            removed: removed
                        });
                    } else {
                        config.serveJson(res, 404, {
                            message: 'Resource not found'
                        });
                    }
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return remove;
        });

    console.log('\tPOST \t->', projectionRoutePath);
    // POST to route by :id with :projection
    app.post(projectionRoutePath,
        config.authenticateUser,
        /**
         * Post Model collection document by route :id with comma separated :projection from the route
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     JSON response message passed to serveJson
         */
        function postDocumentByIdWithProjection(req, res) {
            return config.serveJson(res, 405, {
                message: 'Posting to a resource with projections is not supported, POST to index for creating new documents'
            });
        });

    console.log('\tGET \t->', projectionRoutePath);
    // GET document by :id with :projection
    app.get(projectionRoutePath,
        config.authenticateUser,
        /**
         * Get Model collection document by route :id limiting any comma separated :projection from the route
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     Q promise resolving to findById method results
         */
        function getDocumentByIdWithProjection(req, res) {
            var projection = config.buildProjectionFromString(req.params.projection);

            var find = crud.findById(req.params.id, projection);
            find.then(
                function onFulfilled(document) {
                    if (document) {
                        config.serveJson(res, 200, document);
                    } else {
                        config.serveJson(res, 404, {
                            message: 'Resource not found'
                        });
                    }
                },
                function onRejected(error) {
                    config.serveError(res, error);
                });
            return find;
        });

    console.log('\tPUT \t->', projectionRoutePath);
    // PUT document by :id with :projection
    app.put(projectionRoutePath,
        config.authenticateUser,
        /**
         * Post Model collection document by route :id with comma separated :projection from the route
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     JSON response message passed to serveJson
         */
        function putDocumentByIdWithProjection(req, res) {
            return config.serveJson(res, 405, {
                message: 'Modifying a resource attribute is not supported. Try modifying the resource instead.'
            });
        });

    console.log('\tDELETE \t->', projectionRoutePath);
    // DELETE document by :id with :projection
    app.delete(projectionRoutePath,
        config.authenticateUser,
        /**
         * Post Model collection document by route :id with comma separated :projection from the route
         * @param  {Object} req http request object
         * @param  {Object} res http response object
         * @return {Object}     JSON response message passed to serveJson
         */
        function deleteDocumentByIdWithProjection(req, res) {
            return config.serveJson(res, 405, {
                message: 'Deleting a resource attribute is not supported. Try deleting the resource instead.'
            });
        });

};

exports.serveCrud = function (Model, config) {
    config = _.extend(exports.config, config || {});
    return {
        fields: _.union(config.getSchemaFields(Model.schema), config.getVirtualFields(Model.schema)),
        api: config.crud(Model)
    };
};
