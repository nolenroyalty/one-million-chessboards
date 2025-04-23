/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const chess = $root.chess = (() => {

    /**
     * Namespace chess.
     * @exports chess
     * @namespace
     */
    const chess = {};

    /**
     * MoveType enum.
     * @name chess.MoveType
     * @enum {number}
     * @property {number} MOVE_TYPE_NORMAL=0 MOVE_TYPE_NORMAL value
     * @property {number} MOVE_TYPE_CASTLE=1 MOVE_TYPE_CASTLE value
     * @property {number} MOVE_TYPE_ENPASSANT=2 MOVE_TYPE_ENPASSANT value
     */
    chess.MoveType = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "MOVE_TYPE_NORMAL"] = 0;
        values[valuesById[1] = "MOVE_TYPE_CASTLE"] = 1;
        values[valuesById[2] = "MOVE_TYPE_ENPASSANT"] = 2;
        return values;
    })();

    chess.ClientPing = (function() {

        /**
         * Properties of a ClientPing.
         * @memberof chess
         * @interface IClientPing
         */

        /**
         * Constructs a new ClientPing.
         * @memberof chess
         * @classdesc Represents a ClientPing.
         * @implements IClientPing
         * @constructor
         * @param {chess.IClientPing=} [properties] Properties to set
         */
        function ClientPing(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Creates a new ClientPing instance using the specified properties.
         * @function create
         * @memberof chess.ClientPing
         * @static
         * @param {chess.IClientPing=} [properties] Properties to set
         * @returns {chess.ClientPing} ClientPing instance
         */
        ClientPing.create = function create(properties) {
            return new ClientPing(properties);
        };

        /**
         * Encodes the specified ClientPing message. Does not implicitly {@link chess.ClientPing.verify|verify} messages.
         * @function encode
         * @memberof chess.ClientPing
         * @static
         * @param {chess.IClientPing} message ClientPing message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientPing.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            return writer;
        };

        /**
         * Encodes the specified ClientPing message, length delimited. Does not implicitly {@link chess.ClientPing.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ClientPing
         * @static
         * @param {chess.IClientPing} message ClientPing message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientPing.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientPing message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ClientPing
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ClientPing} ClientPing
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientPing.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ClientPing();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientPing message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ClientPing
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ClientPing} ClientPing
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientPing.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientPing message.
         * @function verify
         * @memberof chess.ClientPing
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientPing.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            return null;
        };

        /**
         * Creates a ClientPing message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ClientPing
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ClientPing} ClientPing
         */
        ClientPing.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ClientPing)
                return object;
            return new $root.chess.ClientPing();
        };

        /**
         * Creates a plain object from a ClientPing message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ClientPing
         * @static
         * @param {chess.ClientPing} message ClientPing
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientPing.toObject = function toObject() {
            return {};
        };

        /**
         * Converts this ClientPing to JSON.
         * @function toJSON
         * @memberof chess.ClientPing
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientPing.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientPing
         * @function getTypeUrl
         * @memberof chess.ClientPing
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientPing.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ClientPing";
        };

        return ClientPing;
    })();

    chess.ClientSubscribe = (function() {

        /**
         * Properties of a ClientSubscribe.
         * @memberof chess
         * @interface IClientSubscribe
         * @property {number|null} [centerX] ClientSubscribe centerX
         * @property {number|null} [centerY] ClientSubscribe centerY
         */

        /**
         * Constructs a new ClientSubscribe.
         * @memberof chess
         * @classdesc Represents a ClientSubscribe.
         * @implements IClientSubscribe
         * @constructor
         * @param {chess.IClientSubscribe=} [properties] Properties to set
         */
        function ClientSubscribe(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientSubscribe centerX.
         * @member {number} centerX
         * @memberof chess.ClientSubscribe
         * @instance
         */
        ClientSubscribe.prototype.centerX = 0;

        /**
         * ClientSubscribe centerY.
         * @member {number} centerY
         * @memberof chess.ClientSubscribe
         * @instance
         */
        ClientSubscribe.prototype.centerY = 0;

        /**
         * Creates a new ClientSubscribe instance using the specified properties.
         * @function create
         * @memberof chess.ClientSubscribe
         * @static
         * @param {chess.IClientSubscribe=} [properties] Properties to set
         * @returns {chess.ClientSubscribe} ClientSubscribe instance
         */
        ClientSubscribe.create = function create(properties) {
            return new ClientSubscribe(properties);
        };

        /**
         * Encodes the specified ClientSubscribe message. Does not implicitly {@link chess.ClientSubscribe.verify|verify} messages.
         * @function encode
         * @memberof chess.ClientSubscribe
         * @static
         * @param {chess.IClientSubscribe} message ClientSubscribe message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientSubscribe.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.centerX != null && Object.hasOwnProperty.call(message, "centerX"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.centerX);
            if (message.centerY != null && Object.hasOwnProperty.call(message, "centerY"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.centerY);
            return writer;
        };

        /**
         * Encodes the specified ClientSubscribe message, length delimited. Does not implicitly {@link chess.ClientSubscribe.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ClientSubscribe
         * @static
         * @param {chess.IClientSubscribe} message ClientSubscribe message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientSubscribe.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientSubscribe message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ClientSubscribe
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ClientSubscribe} ClientSubscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientSubscribe.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ClientSubscribe();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.centerX = reader.uint32();
                        break;
                    }
                case 2: {
                        message.centerY = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientSubscribe message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ClientSubscribe
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ClientSubscribe} ClientSubscribe
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientSubscribe.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientSubscribe message.
         * @function verify
         * @memberof chess.ClientSubscribe
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientSubscribe.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.centerX != null && message.hasOwnProperty("centerX"))
                if (!$util.isInteger(message.centerX))
                    return "centerX: integer expected";
            if (message.centerY != null && message.hasOwnProperty("centerY"))
                if (!$util.isInteger(message.centerY))
                    return "centerY: integer expected";
            return null;
        };

        /**
         * Creates a ClientSubscribe message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ClientSubscribe
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ClientSubscribe} ClientSubscribe
         */
        ClientSubscribe.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ClientSubscribe)
                return object;
            let message = new $root.chess.ClientSubscribe();
            if (object.centerX != null)
                message.centerX = object.centerX >>> 0;
            if (object.centerY != null)
                message.centerY = object.centerY >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ClientSubscribe message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ClientSubscribe
         * @static
         * @param {chess.ClientSubscribe} message ClientSubscribe
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientSubscribe.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.centerX = 0;
                object.centerY = 0;
            }
            if (message.centerX != null && message.hasOwnProperty("centerX"))
                object.centerX = message.centerX;
            if (message.centerY != null && message.hasOwnProperty("centerY"))
                object.centerY = message.centerY;
            return object;
        };

        /**
         * Converts this ClientSubscribe to JSON.
         * @function toJSON
         * @memberof chess.ClientSubscribe
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientSubscribe.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientSubscribe
         * @function getTypeUrl
         * @memberof chess.ClientSubscribe
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientSubscribe.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ClientSubscribe";
        };

        return ClientSubscribe;
    })();

    chess.ClientMove = (function() {

        /**
         * Properties of a ClientMove.
         * @memberof chess
         * @interface IClientMove
         * @property {number|null} [pieceId] ClientMove pieceId
         * @property {number|null} [fromX] ClientMove fromX
         * @property {number|null} [fromY] ClientMove fromY
         * @property {number|null} [toX] ClientMove toX
         * @property {number|null} [toY] ClientMove toY
         * @property {chess.MoveType|null} [moveType] ClientMove moveType
         * @property {number|null} [moveToken] ClientMove moveToken
         */

        /**
         * Constructs a new ClientMove.
         * @memberof chess
         * @classdesc Represents a ClientMove.
         * @implements IClientMove
         * @constructor
         * @param {chess.IClientMove=} [properties] Properties to set
         */
        function ClientMove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientMove pieceId.
         * @member {number} pieceId
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.pieceId = 0;

        /**
         * ClientMove fromX.
         * @member {number} fromX
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.fromX = 0;

        /**
         * ClientMove fromY.
         * @member {number} fromY
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.fromY = 0;

        /**
         * ClientMove toX.
         * @member {number} toX
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.toX = 0;

        /**
         * ClientMove toY.
         * @member {number} toY
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.toY = 0;

        /**
         * ClientMove moveType.
         * @member {chess.MoveType} moveType
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.moveType = 0;

        /**
         * ClientMove moveToken.
         * @member {number} moveToken
         * @memberof chess.ClientMove
         * @instance
         */
        ClientMove.prototype.moveToken = 0;

        /**
         * Creates a new ClientMove instance using the specified properties.
         * @function create
         * @memberof chess.ClientMove
         * @static
         * @param {chess.IClientMove=} [properties] Properties to set
         * @returns {chess.ClientMove} ClientMove instance
         */
        ClientMove.create = function create(properties) {
            return new ClientMove(properties);
        };

        /**
         * Encodes the specified ClientMove message. Does not implicitly {@link chess.ClientMove.verify|verify} messages.
         * @function encode
         * @memberof chess.ClientMove
         * @static
         * @param {chess.IClientMove} message ClientMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientMove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.pieceId != null && Object.hasOwnProperty.call(message, "pieceId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.pieceId);
            if (message.fromX != null && Object.hasOwnProperty.call(message, "fromX"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.fromX);
            if (message.fromY != null && Object.hasOwnProperty.call(message, "fromY"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.fromY);
            if (message.toX != null && Object.hasOwnProperty.call(message, "toX"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.toX);
            if (message.toY != null && Object.hasOwnProperty.call(message, "toY"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.toY);
            if (message.moveType != null && Object.hasOwnProperty.call(message, "moveType"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.moveType);
            if (message.moveToken != null && Object.hasOwnProperty.call(message, "moveToken"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.moveToken);
            return writer;
        };

        /**
         * Encodes the specified ClientMove message, length delimited. Does not implicitly {@link chess.ClientMove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ClientMove
         * @static
         * @param {chess.IClientMove} message ClientMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientMove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientMove message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ClientMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ClientMove} ClientMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientMove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ClientMove();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.pieceId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.fromX = reader.uint32();
                        break;
                    }
                case 3: {
                        message.fromY = reader.uint32();
                        break;
                    }
                case 4: {
                        message.toX = reader.uint32();
                        break;
                    }
                case 5: {
                        message.toY = reader.uint32();
                        break;
                    }
                case 6: {
                        message.moveType = reader.int32();
                        break;
                    }
                case 7: {
                        message.moveToken = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientMove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ClientMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ClientMove} ClientMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientMove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientMove message.
         * @function verify
         * @memberof chess.ClientMove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientMove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.pieceId != null && message.hasOwnProperty("pieceId"))
                if (!$util.isInteger(message.pieceId))
                    return "pieceId: integer expected";
            if (message.fromX != null && message.hasOwnProperty("fromX"))
                if (!$util.isInteger(message.fromX))
                    return "fromX: integer expected";
            if (message.fromY != null && message.hasOwnProperty("fromY"))
                if (!$util.isInteger(message.fromY))
                    return "fromY: integer expected";
            if (message.toX != null && message.hasOwnProperty("toX"))
                if (!$util.isInteger(message.toX))
                    return "toX: integer expected";
            if (message.toY != null && message.hasOwnProperty("toY"))
                if (!$util.isInteger(message.toY))
                    return "toY: integer expected";
            if (message.moveType != null && message.hasOwnProperty("moveType"))
                switch (message.moveType) {
                default:
                    return "moveType: enum value expected";
                case 0:
                case 1:
                case 2:
                    break;
                }
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                if (!$util.isInteger(message.moveToken))
                    return "moveToken: integer expected";
            return null;
        };

        /**
         * Creates a ClientMove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ClientMove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ClientMove} ClientMove
         */
        ClientMove.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ClientMove)
                return object;
            let message = new $root.chess.ClientMove();
            if (object.pieceId != null)
                message.pieceId = object.pieceId >>> 0;
            if (object.fromX != null)
                message.fromX = object.fromX >>> 0;
            if (object.fromY != null)
                message.fromY = object.fromY >>> 0;
            if (object.toX != null)
                message.toX = object.toX >>> 0;
            if (object.toY != null)
                message.toY = object.toY >>> 0;
            switch (object.moveType) {
            default:
                if (typeof object.moveType === "number") {
                    message.moveType = object.moveType;
                    break;
                }
                break;
            case "MOVE_TYPE_NORMAL":
            case 0:
                message.moveType = 0;
                break;
            case "MOVE_TYPE_CASTLE":
            case 1:
                message.moveType = 1;
                break;
            case "MOVE_TYPE_ENPASSANT":
            case 2:
                message.moveType = 2;
                break;
            }
            if (object.moveToken != null)
                message.moveToken = object.moveToken >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ClientMove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ClientMove
         * @static
         * @param {chess.ClientMove} message ClientMove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientMove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.pieceId = 0;
                object.fromX = 0;
                object.fromY = 0;
                object.toX = 0;
                object.toY = 0;
                object.moveType = options.enums === String ? "MOVE_TYPE_NORMAL" : 0;
                object.moveToken = 0;
            }
            if (message.pieceId != null && message.hasOwnProperty("pieceId"))
                object.pieceId = message.pieceId;
            if (message.fromX != null && message.hasOwnProperty("fromX"))
                object.fromX = message.fromX;
            if (message.fromY != null && message.hasOwnProperty("fromY"))
                object.fromY = message.fromY;
            if (message.toX != null && message.hasOwnProperty("toX"))
                object.toX = message.toX;
            if (message.toY != null && message.hasOwnProperty("toY"))
                object.toY = message.toY;
            if (message.moveType != null && message.hasOwnProperty("moveType"))
                object.moveType = options.enums === String ? $root.chess.MoveType[message.moveType] === undefined ? message.moveType : $root.chess.MoveType[message.moveType] : message.moveType;
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                object.moveToken = message.moveToken;
            return object;
        };

        /**
         * Converts this ClientMove to JSON.
         * @function toJSON
         * @memberof chess.ClientMove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientMove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientMove
         * @function getTypeUrl
         * @memberof chess.ClientMove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientMove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ClientMove";
        };

        return ClientMove;
    })();

    chess.ClientMessage = (function() {

        /**
         * Properties of a ClientMessage.
         * @memberof chess
         * @interface IClientMessage
         * @property {chess.IClientPing|null} [ping] ClientMessage ping
         * @property {chess.IClientSubscribe|null} [subscribe] ClientMessage subscribe
         * @property {chess.IClientMove|null} [move] ClientMessage move
         */

        /**
         * Constructs a new ClientMessage.
         * @memberof chess
         * @classdesc Represents a ClientMessage.
         * @implements IClientMessage
         * @constructor
         * @param {chess.IClientMessage=} [properties] Properties to set
         */
        function ClientMessage(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientMessage ping.
         * @member {chess.IClientPing|null|undefined} ping
         * @memberof chess.ClientMessage
         * @instance
         */
        ClientMessage.prototype.ping = null;

        /**
         * ClientMessage subscribe.
         * @member {chess.IClientSubscribe|null|undefined} subscribe
         * @memberof chess.ClientMessage
         * @instance
         */
        ClientMessage.prototype.subscribe = null;

        /**
         * ClientMessage move.
         * @member {chess.IClientMove|null|undefined} move
         * @memberof chess.ClientMessage
         * @instance
         */
        ClientMessage.prototype.move = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * ClientMessage payload.
         * @member {"ping"|"subscribe"|"move"|undefined} payload
         * @memberof chess.ClientMessage
         * @instance
         */
        Object.defineProperty(ClientMessage.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["ping", "subscribe", "move"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ClientMessage instance using the specified properties.
         * @function create
         * @memberof chess.ClientMessage
         * @static
         * @param {chess.IClientMessage=} [properties] Properties to set
         * @returns {chess.ClientMessage} ClientMessage instance
         */
        ClientMessage.create = function create(properties) {
            return new ClientMessage(properties);
        };

        /**
         * Encodes the specified ClientMessage message. Does not implicitly {@link chess.ClientMessage.verify|verify} messages.
         * @function encode
         * @memberof chess.ClientMessage
         * @static
         * @param {chess.IClientMessage} message ClientMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ping != null && Object.hasOwnProperty.call(message, "ping"))
                $root.chess.ClientPing.encode(message.ping, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.subscribe != null && Object.hasOwnProperty.call(message, "subscribe"))
                $root.chess.ClientSubscribe.encode(message.subscribe, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.move != null && Object.hasOwnProperty.call(message, "move"))
                $root.chess.ClientMove.encode(message.move, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ClientMessage message, length delimited. Does not implicitly {@link chess.ClientMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ClientMessage
         * @static
         * @param {chess.IClientMessage} message ClientMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientMessage message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ClientMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ClientMessage} ClientMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ClientMessage();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.ping = $root.chess.ClientPing.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.subscribe = $root.chess.ClientSubscribe.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.move = $root.chess.ClientMove.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ClientMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ClientMessage} ClientMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientMessage message.
         * @function verify
         * @memberof chess.ClientMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.ping != null && message.hasOwnProperty("ping")) {
                properties.payload = 1;
                {
                    let error = $root.chess.ClientPing.verify(message.ping);
                    if (error)
                        return "ping." + error;
                }
            }
            if (message.subscribe != null && message.hasOwnProperty("subscribe")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ClientSubscribe.verify(message.subscribe);
                    if (error)
                        return "subscribe." + error;
                }
            }
            if (message.move != null && message.hasOwnProperty("move")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ClientMove.verify(message.move);
                    if (error)
                        return "move." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ClientMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ClientMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ClientMessage} ClientMessage
         */
        ClientMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ClientMessage)
                return object;
            let message = new $root.chess.ClientMessage();
            if (object.ping != null) {
                if (typeof object.ping !== "object")
                    throw TypeError(".chess.ClientMessage.ping: object expected");
                message.ping = $root.chess.ClientPing.fromObject(object.ping);
            }
            if (object.subscribe != null) {
                if (typeof object.subscribe !== "object")
                    throw TypeError(".chess.ClientMessage.subscribe: object expected");
                message.subscribe = $root.chess.ClientSubscribe.fromObject(object.subscribe);
            }
            if (object.move != null) {
                if (typeof object.move !== "object")
                    throw TypeError(".chess.ClientMessage.move: object expected");
                message.move = $root.chess.ClientMove.fromObject(object.move);
            }
            return message;
        };

        /**
         * Creates a plain object from a ClientMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ClientMessage
         * @static
         * @param {chess.ClientMessage} message ClientMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.ping != null && message.hasOwnProperty("ping")) {
                object.ping = $root.chess.ClientPing.toObject(message.ping, options);
                if (options.oneofs)
                    object.payload = "ping";
            }
            if (message.subscribe != null && message.hasOwnProperty("subscribe")) {
                object.subscribe = $root.chess.ClientSubscribe.toObject(message.subscribe, options);
                if (options.oneofs)
                    object.payload = "subscribe";
            }
            if (message.move != null && message.hasOwnProperty("move")) {
                object.move = $root.chess.ClientMove.toObject(message.move, options);
                if (options.oneofs)
                    object.payload = "move";
            }
            return object;
        };

        /**
         * Converts this ClientMessage to JSON.
         * @function toJSON
         * @memberof chess.ClientMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientMessage
         * @function getTypeUrl
         * @memberof chess.ClientMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ClientMessage";
        };

        return ClientMessage;
    })();

    return chess;
})();

export { $root as default };
