mongoose-edgeapi
================

Powerful REST and Web Sockets API for MongoDB collections using Mongoose and Express.

## Web Sockets Services Available

### GET

#### `api.collection-name.save`

- ***Expects:*** Object passed to event listener with document to save
- ***Emits:*** `api.collection-name.save.response` or `api.collection-name.save.error`

#### `api.collection-name.find`

- ***Expects:*** Object passed to event listener with collection query, may include proprietary fields `limit`, `page`, `sort` and `projection`. If finding by `ObjectId` you can use `id` or `_id` property.
- ***Emits:*** `api.collection-name.find.response` or `api.collection-name.find.error`

#### `api.collection-name.update`

- ***Expects:*** Object passed to event listener with id and document updates to make, expects `id` or `_id` property in object with valid document `ObjectId`. For bulk updates a `_query` parameter can be supplied with the query specifics to match documents against.
- ***Emits:*** `api.collection-name.update.response` or `api.collection-name.update.error`

#### `api.collection-name.delete`

- ***Expects:*** Object passed to event listener with query for delete to make. If deleting by `ObjectId` you can use `id` or `_id` property.
- ***Emits:*** `api.collection-name.remove.delete` or `api.collection-name.remove.delete`


## REST Services Available

### GET

#### `/api/collection-name/`

- **Valid Route and Method:** Yes
- **Purpose:** Returns all documents from the collection
- **Supports Query Parameters:** This route does support query parameters to influence the document result set.

#### `/api/collection-name/:projection`

- **Valid Route and Method:** Yes
- **Purpose:** Returns all documents from the collection, fields returned are limited to the comma separated values included in the projection value
- **Supports Query Parameters:** This route does support query parameters to influence the document result set.

#### `/api/collection-name/:id`

- **Valid Route and Method:** Yes
- **Purpose:** Returns specific document from the collection based on it's _id
- **Supports Query Parameters:** This route does not support query parameters.

#### `/api/collection-name/:id/:projection`

- **Valid Route and Method:** Yes
- **Purpose:** Returns specific document from the collection based on it's _id, fields returned are limited to the comma separated values included in the projection value
- **Supports Query Parameters:** This route does not support query parameters.

### POST

#### `/api/collection-name/`

- **Valid Route and Method:** Yes
- **Purpose:** Adds a new document to the collection.
- **Supports Query Parameters:** This route does support some parameters to influence the document creation, they will be merged with the values POSTed to the request body with POSTed values taking a higher precedence.

#### `/api/collection-name/:id`

- **Valid Route and Method:** No
- **Purpose:** Not supported, error message returned.

#### `/api/collection-name/:id/:projection`

- **Valid Route and Method:** No
- **Purpose:** Not supported, error message returned.

### PUT

#### `/api/collection-name/`

- **Valid Route and Method:** Yes
- **Purpose:** Bulk update of documents matching query formed from GET parameters
- **Supports Query Parameters:** Yes, these are used in forming the query to matching the documents to update. The PUT body will be the document updates.

#### `/api/collection-name/:id`

- **Valid Route and Method:** Yes
- **Purpose:** Updates a new document by _id within the collection.
- **Supports Query Parameters:** This route does support some parameters to influence the document update, they will be merged with the body of POST, with POST values taking a higher precedence.

#### `/api/collection-name/:id/:projection`

- **Valid Route and Method:** No
- **Purpose:** Not supported, error message returned.

### DELETE

#### `/api/collection-name/`

- **Valid Route and Method:** Yes
- **Purpose:** Deletes all documents within the collection matching query, be careful you can delete all documents if no query is supplied!
- **Supports Query Parameters:** This route does support some parameters to influence the document deleting, they will be merged with the body of the DELETE request with DELETE values taking a higher precedence.

#### `/api/collection-name/:id`

- **Valid Route and Method:** Yes
- **Purpose:** Deletes a specific document from the collection based on it's _id
- **Supports Query Parameters:** This route does not support query parameters.

#### `/api/collection-name/:id/:projection`

- **Valid Route and Method:** No
- **Purpose:** Not supported, error message returned.
