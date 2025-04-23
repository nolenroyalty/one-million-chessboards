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
     * @property {number} MOVE_TYPE_EN_PASSANT=2 MOVE_TYPE_EN_PASSANT value
     */
    chess.MoveType = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "MOVE_TYPE_NORMAL"] = 0;
        values[valuesById[1] = "MOVE_TYPE_CASTLE"] = 1;
        values[valuesById[2] = "MOVE_TYPE_EN_PASSANT"] = 2;
        return values;
    })();

    /**
     * PieceType enum.
     * @name chess.PieceType
     * @enum {number}
     * @property {number} PIECE_TYPE_PAWN=0 PIECE_TYPE_PAWN value
     * @property {number} PIECE_TYPE_KNIGHT=1 PIECE_TYPE_KNIGHT value
     * @property {number} PIECE_TYPE_BISHOP=2 PIECE_TYPE_BISHOP value
     * @property {number} PIECE_TYPE_ROOK=3 PIECE_TYPE_ROOK value
     * @property {number} PIECE_TYPE_QUEEN=4 PIECE_TYPE_QUEEN value
     * @property {number} PIECE_TYPE_KING=5 PIECE_TYPE_KING value
     * @property {number} PIECE_TYPE_PROMOTED_PAWN=6 PIECE_TYPE_PROMOTED_PAWN value
     */
    chess.PieceType = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "PIECE_TYPE_PAWN"] = 0;
        values[valuesById[1] = "PIECE_TYPE_KNIGHT"] = 1;
        values[valuesById[2] = "PIECE_TYPE_BISHOP"] = 2;
        values[valuesById[3] = "PIECE_TYPE_ROOK"] = 3;
        values[valuesById[4] = "PIECE_TYPE_QUEEN"] = 4;
        values[valuesById[5] = "PIECE_TYPE_KING"] = 5;
        values[valuesById[6] = "PIECE_TYPE_PROMOTED_PAWN"] = 6;
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
            case "MOVE_TYPE_EN_PASSANT":
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

    chess.ServerValidMove = (function() {

        /**
         * Properties of a ServerValidMove.
         * @memberof chess
         * @interface IServerValidMove
         * @property {number|Long|null} [asOfSeqnum] ServerValidMove asOfSeqnum
         * @property {number|null} [moveToken] ServerValidMove moveToken
         * @property {number|null} [capturedPieceId] ServerValidMove capturedPieceId
         */

        /**
         * Constructs a new ServerValidMove.
         * @memberof chess
         * @classdesc Represents a ServerValidMove.
         * @implements IServerValidMove
         * @constructor
         * @param {chess.IServerValidMove=} [properties] Properties to set
         */
        function ServerValidMove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerValidMove asOfSeqnum.
         * @member {number|Long} asOfSeqnum
         * @memberof chess.ServerValidMove
         * @instance
         */
        ServerValidMove.prototype.asOfSeqnum = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * ServerValidMove moveToken.
         * @member {number} moveToken
         * @memberof chess.ServerValidMove
         * @instance
         */
        ServerValidMove.prototype.moveToken = 0;

        /**
         * ServerValidMove capturedPieceId.
         * @member {number} capturedPieceId
         * @memberof chess.ServerValidMove
         * @instance
         */
        ServerValidMove.prototype.capturedPieceId = 0;

        /**
         * Creates a new ServerValidMove instance using the specified properties.
         * @function create
         * @memberof chess.ServerValidMove
         * @static
         * @param {chess.IServerValidMove=} [properties] Properties to set
         * @returns {chess.ServerValidMove} ServerValidMove instance
         */
        ServerValidMove.create = function create(properties) {
            return new ServerValidMove(properties);
        };

        /**
         * Encodes the specified ServerValidMove message. Does not implicitly {@link chess.ServerValidMove.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerValidMove
         * @static
         * @param {chess.IServerValidMove} message ServerValidMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerValidMove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.asOfSeqnum != null && Object.hasOwnProperty.call(message, "asOfSeqnum"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.asOfSeqnum);
            if (message.moveToken != null && Object.hasOwnProperty.call(message, "moveToken"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.moveToken);
            if (message.capturedPieceId != null && Object.hasOwnProperty.call(message, "capturedPieceId"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.capturedPieceId);
            return writer;
        };

        /**
         * Encodes the specified ServerValidMove message, length delimited. Does not implicitly {@link chess.ServerValidMove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerValidMove
         * @static
         * @param {chess.IServerValidMove} message ServerValidMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerValidMove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerValidMove message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerValidMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerValidMove} ServerValidMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerValidMove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerValidMove();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.asOfSeqnum = reader.uint64();
                        break;
                    }
                case 2: {
                        message.moveToken = reader.uint32();
                        break;
                    }
                case 3: {
                        message.capturedPieceId = reader.uint32();
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
         * Decodes a ServerValidMove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerValidMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerValidMove} ServerValidMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerValidMove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerValidMove message.
         * @function verify
         * @memberof chess.ServerValidMove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerValidMove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.asOfSeqnum != null && message.hasOwnProperty("asOfSeqnum"))
                if (!$util.isInteger(message.asOfSeqnum) && !(message.asOfSeqnum && $util.isInteger(message.asOfSeqnum.low) && $util.isInteger(message.asOfSeqnum.high)))
                    return "asOfSeqnum: integer|Long expected";
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                if (!$util.isInteger(message.moveToken))
                    return "moveToken: integer expected";
            if (message.capturedPieceId != null && message.hasOwnProperty("capturedPieceId"))
                if (!$util.isInteger(message.capturedPieceId))
                    return "capturedPieceId: integer expected";
            return null;
        };

        /**
         * Creates a ServerValidMove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerValidMove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerValidMove} ServerValidMove
         */
        ServerValidMove.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerValidMove)
                return object;
            let message = new $root.chess.ServerValidMove();
            if (object.asOfSeqnum != null)
                if ($util.Long)
                    (message.asOfSeqnum = $util.Long.fromValue(object.asOfSeqnum)).unsigned = true;
                else if (typeof object.asOfSeqnum === "string")
                    message.asOfSeqnum = parseInt(object.asOfSeqnum, 10);
                else if (typeof object.asOfSeqnum === "number")
                    message.asOfSeqnum = object.asOfSeqnum;
                else if (typeof object.asOfSeqnum === "object")
                    message.asOfSeqnum = new $util.LongBits(object.asOfSeqnum.low >>> 0, object.asOfSeqnum.high >>> 0).toNumber(true);
            if (object.moveToken != null)
                message.moveToken = object.moveToken >>> 0;
            if (object.capturedPieceId != null)
                message.capturedPieceId = object.capturedPieceId >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ServerValidMove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerValidMove
         * @static
         * @param {chess.ServerValidMove} message ServerValidMove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerValidMove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.asOfSeqnum = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.asOfSeqnum = options.longs === String ? "0" : 0;
                object.moveToken = 0;
                object.capturedPieceId = 0;
            }
            if (message.asOfSeqnum != null && message.hasOwnProperty("asOfSeqnum"))
                if (typeof message.asOfSeqnum === "number")
                    object.asOfSeqnum = options.longs === String ? String(message.asOfSeqnum) : message.asOfSeqnum;
                else
                    object.asOfSeqnum = options.longs === String ? $util.Long.prototype.toString.call(message.asOfSeqnum) : options.longs === Number ? new $util.LongBits(message.asOfSeqnum.low >>> 0, message.asOfSeqnum.high >>> 0).toNumber(true) : message.asOfSeqnum;
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                object.moveToken = message.moveToken;
            if (message.capturedPieceId != null && message.hasOwnProperty("capturedPieceId"))
                object.capturedPieceId = message.capturedPieceId;
            return object;
        };

        /**
         * Converts this ServerValidMove to JSON.
         * @function toJSON
         * @memberof chess.ServerValidMove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerValidMove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerValidMove
         * @function getTypeUrl
         * @memberof chess.ServerValidMove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerValidMove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerValidMove";
        };

        return ServerValidMove;
    })();

    chess.ServerInvalidMove = (function() {

        /**
         * Properties of a ServerInvalidMove.
         * @memberof chess
         * @interface IServerInvalidMove
         * @property {number|null} [moveToken] ServerInvalidMove moveToken
         */

        /**
         * Constructs a new ServerInvalidMove.
         * @memberof chess
         * @classdesc Represents a ServerInvalidMove.
         * @implements IServerInvalidMove
         * @constructor
         * @param {chess.IServerInvalidMove=} [properties] Properties to set
         */
        function ServerInvalidMove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerInvalidMove moveToken.
         * @member {number} moveToken
         * @memberof chess.ServerInvalidMove
         * @instance
         */
        ServerInvalidMove.prototype.moveToken = 0;

        /**
         * Creates a new ServerInvalidMove instance using the specified properties.
         * @function create
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {chess.IServerInvalidMove=} [properties] Properties to set
         * @returns {chess.ServerInvalidMove} ServerInvalidMove instance
         */
        ServerInvalidMove.create = function create(properties) {
            return new ServerInvalidMove(properties);
        };

        /**
         * Encodes the specified ServerInvalidMove message. Does not implicitly {@link chess.ServerInvalidMove.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {chess.IServerInvalidMove} message ServerInvalidMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerInvalidMove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.moveToken != null && Object.hasOwnProperty.call(message, "moveToken"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.moveToken);
            return writer;
        };

        /**
         * Encodes the specified ServerInvalidMove message, length delimited. Does not implicitly {@link chess.ServerInvalidMove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {chess.IServerInvalidMove} message ServerInvalidMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerInvalidMove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerInvalidMove message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerInvalidMove} ServerInvalidMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerInvalidMove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerInvalidMove();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
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
         * Decodes a ServerInvalidMove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerInvalidMove} ServerInvalidMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerInvalidMove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerInvalidMove message.
         * @function verify
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerInvalidMove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                if (!$util.isInteger(message.moveToken))
                    return "moveToken: integer expected";
            return null;
        };

        /**
         * Creates a ServerInvalidMove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerInvalidMove} ServerInvalidMove
         */
        ServerInvalidMove.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerInvalidMove)
                return object;
            let message = new $root.chess.ServerInvalidMove();
            if (object.moveToken != null)
                message.moveToken = object.moveToken >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ServerInvalidMove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {chess.ServerInvalidMove} message ServerInvalidMove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerInvalidMove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults)
                object.moveToken = 0;
            if (message.moveToken != null && message.hasOwnProperty("moveToken"))
                object.moveToken = message.moveToken;
            return object;
        };

        /**
         * Converts this ServerInvalidMove to JSON.
         * @function toJSON
         * @memberof chess.ServerInvalidMove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerInvalidMove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerInvalidMove
         * @function getTypeUrl
         * @memberof chess.ServerInvalidMove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerInvalidMove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerInvalidMove";
        };

        return ServerInvalidMove;
    })();

    chess.ServerPong = (function() {

        /**
         * Properties of a ServerPong.
         * @memberof chess
         * @interface IServerPong
         */

        /**
         * Constructs a new ServerPong.
         * @memberof chess
         * @classdesc Represents a ServerPong.
         * @implements IServerPong
         * @constructor
         * @param {chess.IServerPong=} [properties] Properties to set
         */
        function ServerPong(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Creates a new ServerPong instance using the specified properties.
         * @function create
         * @memberof chess.ServerPong
         * @static
         * @param {chess.IServerPong=} [properties] Properties to set
         * @returns {chess.ServerPong} ServerPong instance
         */
        ServerPong.create = function create(properties) {
            return new ServerPong(properties);
        };

        /**
         * Encodes the specified ServerPong message. Does not implicitly {@link chess.ServerPong.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerPong
         * @static
         * @param {chess.IServerPong} message ServerPong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerPong.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            return writer;
        };

        /**
         * Encodes the specified ServerPong message, length delimited. Does not implicitly {@link chess.ServerPong.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerPong
         * @static
         * @param {chess.IServerPong} message ServerPong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerPong.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerPong message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerPong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerPong} ServerPong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerPong.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerPong();
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
         * Decodes a ServerPong message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerPong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerPong} ServerPong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerPong.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerPong message.
         * @function verify
         * @memberof chess.ServerPong
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerPong.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            return null;
        };

        /**
         * Creates a ServerPong message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerPong
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerPong} ServerPong
         */
        ServerPong.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerPong)
                return object;
            return new $root.chess.ServerPong();
        };

        /**
         * Creates a plain object from a ServerPong message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerPong
         * @static
         * @param {chess.ServerPong} message ServerPong
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerPong.toObject = function toObject() {
            return {};
        };

        /**
         * Converts this ServerPong to JSON.
         * @function toJSON
         * @memberof chess.ServerPong
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerPong.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerPong
         * @function getTypeUrl
         * @memberof chess.ServerPong
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerPong.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerPong";
        };

        return ServerPong;
    })();

    chess.PieceCapture = (function() {

        /**
         * Properties of a PieceCapture.
         * @memberof chess
         * @interface IPieceCapture
         * @property {number|null} [capturedPieceId] PieceCapture capturedPieceId
         * @property {number|Long|null} [seqnum] PieceCapture seqnum
         */

        /**
         * Constructs a new PieceCapture.
         * @memberof chess
         * @classdesc Represents a PieceCapture.
         * @implements IPieceCapture
         * @constructor
         * @param {chess.IPieceCapture=} [properties] Properties to set
         */
        function PieceCapture(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PieceCapture capturedPieceId.
         * @member {number} capturedPieceId
         * @memberof chess.PieceCapture
         * @instance
         */
        PieceCapture.prototype.capturedPieceId = 0;

        /**
         * PieceCapture seqnum.
         * @member {number|Long} seqnum
         * @memberof chess.PieceCapture
         * @instance
         */
        PieceCapture.prototype.seqnum = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new PieceCapture instance using the specified properties.
         * @function create
         * @memberof chess.PieceCapture
         * @static
         * @param {chess.IPieceCapture=} [properties] Properties to set
         * @returns {chess.PieceCapture} PieceCapture instance
         */
        PieceCapture.create = function create(properties) {
            return new PieceCapture(properties);
        };

        /**
         * Encodes the specified PieceCapture message. Does not implicitly {@link chess.PieceCapture.verify|verify} messages.
         * @function encode
         * @memberof chess.PieceCapture
         * @static
         * @param {chess.IPieceCapture} message PieceCapture message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceCapture.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.capturedPieceId != null && Object.hasOwnProperty.call(message, "capturedPieceId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.capturedPieceId);
            if (message.seqnum != null && Object.hasOwnProperty.call(message, "seqnum"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.seqnum);
            return writer;
        };

        /**
         * Encodes the specified PieceCapture message, length delimited. Does not implicitly {@link chess.PieceCapture.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.PieceCapture
         * @static
         * @param {chess.IPieceCapture} message PieceCapture message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceCapture.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PieceCapture message from the specified reader or buffer.
         * @function decode
         * @memberof chess.PieceCapture
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.PieceCapture} PieceCapture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceCapture.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.PieceCapture();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.capturedPieceId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.seqnum = reader.uint64();
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
         * Decodes a PieceCapture message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.PieceCapture
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.PieceCapture} PieceCapture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceCapture.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PieceCapture message.
         * @function verify
         * @memberof chess.PieceCapture
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PieceCapture.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.capturedPieceId != null && message.hasOwnProperty("capturedPieceId"))
                if (!$util.isInteger(message.capturedPieceId))
                    return "capturedPieceId: integer expected";
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (!$util.isInteger(message.seqnum) && !(message.seqnum && $util.isInteger(message.seqnum.low) && $util.isInteger(message.seqnum.high)))
                    return "seqnum: integer|Long expected";
            return null;
        };

        /**
         * Creates a PieceCapture message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.PieceCapture
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.PieceCapture} PieceCapture
         */
        PieceCapture.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.PieceCapture)
                return object;
            let message = new $root.chess.PieceCapture();
            if (object.capturedPieceId != null)
                message.capturedPieceId = object.capturedPieceId >>> 0;
            if (object.seqnum != null)
                if ($util.Long)
                    (message.seqnum = $util.Long.fromValue(object.seqnum)).unsigned = true;
                else if (typeof object.seqnum === "string")
                    message.seqnum = parseInt(object.seqnum, 10);
                else if (typeof object.seqnum === "number")
                    message.seqnum = object.seqnum;
                else if (typeof object.seqnum === "object")
                    message.seqnum = new $util.LongBits(object.seqnum.low >>> 0, object.seqnum.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a PieceCapture message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.PieceCapture
         * @static
         * @param {chess.PieceCapture} message PieceCapture
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PieceCapture.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.capturedPieceId = 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.seqnum = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.seqnum = options.longs === String ? "0" : 0;
            }
            if (message.capturedPieceId != null && message.hasOwnProperty("capturedPieceId"))
                object.capturedPieceId = message.capturedPieceId;
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (typeof message.seqnum === "number")
                    object.seqnum = options.longs === String ? String(message.seqnum) : message.seqnum;
                else
                    object.seqnum = options.longs === String ? $util.Long.prototype.toString.call(message.seqnum) : options.longs === Number ? new $util.LongBits(message.seqnum.low >>> 0, message.seqnum.high >>> 0).toNumber(true) : message.seqnum;
            return object;
        };

        /**
         * Converts this PieceCapture to JSON.
         * @function toJSON
         * @memberof chess.PieceCapture
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PieceCapture.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PieceCapture
         * @function getTypeUrl
         * @memberof chess.PieceCapture
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PieceCapture.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.PieceCapture";
        };

        return PieceCapture;
    })();

    chess.PieceDataShared = (function() {

        /**
         * Properties of a PieceDataShared.
         * @memberof chess
         * @interface IPieceDataShared
         * @property {number|null} [id] PieceDataShared id
         * @property {chess.PieceType|null} [type] PieceDataShared type
         * @property {boolean|null} [isWhite] PieceDataShared isWhite
         * @property {boolean|null} [justDoubleMoved] PieceDataShared justDoubleMoved
         * @property {boolean|null} [kingKiller] PieceDataShared kingKiller
         * @property {boolean|null} [kingPawner] PieceDataShared kingPawner
         * @property {boolean|null} [queenKiller] PieceDataShared queenKiller
         * @property {boolean|null} [queenPawner] PieceDataShared queenPawner
         * @property {boolean|null} [adoptedKiller] PieceDataShared adoptedKiller
         * @property {boolean|null} [adopted] PieceDataShared adopted
         * @property {boolean|null} [hasCapturedPieceTypeOtherThanOwn] PieceDataShared hasCapturedPieceTypeOtherThanOwn
         * @property {number|null} [moveCount] PieceDataShared moveCount
         * @property {number|null} [captureCount] PieceDataShared captureCount
         */

        /**
         * Constructs a new PieceDataShared.
         * @memberof chess
         * @classdesc Represents a PieceDataShared.
         * @implements IPieceDataShared
         * @constructor
         * @param {chess.IPieceDataShared=} [properties] Properties to set
         */
        function PieceDataShared(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PieceDataShared id.
         * @member {number} id
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.id = 0;

        /**
         * PieceDataShared type.
         * @member {chess.PieceType} type
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.type = 0;

        /**
         * PieceDataShared isWhite.
         * @member {boolean} isWhite
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.isWhite = false;

        /**
         * PieceDataShared justDoubleMoved.
         * @member {boolean} justDoubleMoved
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.justDoubleMoved = false;

        /**
         * PieceDataShared kingKiller.
         * @member {boolean} kingKiller
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.kingKiller = false;

        /**
         * PieceDataShared kingPawner.
         * @member {boolean} kingPawner
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.kingPawner = false;

        /**
         * PieceDataShared queenKiller.
         * @member {boolean} queenKiller
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.queenKiller = false;

        /**
         * PieceDataShared queenPawner.
         * @member {boolean} queenPawner
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.queenPawner = false;

        /**
         * PieceDataShared adoptedKiller.
         * @member {boolean} adoptedKiller
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.adoptedKiller = false;

        /**
         * PieceDataShared adopted.
         * @member {boolean} adopted
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.adopted = false;

        /**
         * PieceDataShared hasCapturedPieceTypeOtherThanOwn.
         * @member {boolean} hasCapturedPieceTypeOtherThanOwn
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.hasCapturedPieceTypeOtherThanOwn = false;

        /**
         * PieceDataShared moveCount.
         * @member {number} moveCount
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.moveCount = 0;

        /**
         * PieceDataShared captureCount.
         * @member {number} captureCount
         * @memberof chess.PieceDataShared
         * @instance
         */
        PieceDataShared.prototype.captureCount = 0;

        /**
         * Creates a new PieceDataShared instance using the specified properties.
         * @function create
         * @memberof chess.PieceDataShared
         * @static
         * @param {chess.IPieceDataShared=} [properties] Properties to set
         * @returns {chess.PieceDataShared} PieceDataShared instance
         */
        PieceDataShared.create = function create(properties) {
            return new PieceDataShared(properties);
        };

        /**
         * Encodes the specified PieceDataShared message. Does not implicitly {@link chess.PieceDataShared.verify|verify} messages.
         * @function encode
         * @memberof chess.PieceDataShared
         * @static
         * @param {chess.IPieceDataShared} message PieceDataShared message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataShared.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.id);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.type);
            if (message.isWhite != null && Object.hasOwnProperty.call(message, "isWhite"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.isWhite);
            if (message.justDoubleMoved != null && Object.hasOwnProperty.call(message, "justDoubleMoved"))
                writer.uint32(/* id 4, wireType 0 =*/32).bool(message.justDoubleMoved);
            if (message.kingKiller != null && Object.hasOwnProperty.call(message, "kingKiller"))
                writer.uint32(/* id 5, wireType 0 =*/40).bool(message.kingKiller);
            if (message.kingPawner != null && Object.hasOwnProperty.call(message, "kingPawner"))
                writer.uint32(/* id 6, wireType 0 =*/48).bool(message.kingPawner);
            if (message.queenKiller != null && Object.hasOwnProperty.call(message, "queenKiller"))
                writer.uint32(/* id 7, wireType 0 =*/56).bool(message.queenKiller);
            if (message.queenPawner != null && Object.hasOwnProperty.call(message, "queenPawner"))
                writer.uint32(/* id 8, wireType 0 =*/64).bool(message.queenPawner);
            if (message.adoptedKiller != null && Object.hasOwnProperty.call(message, "adoptedKiller"))
                writer.uint32(/* id 9, wireType 0 =*/72).bool(message.adoptedKiller);
            if (message.adopted != null && Object.hasOwnProperty.call(message, "adopted"))
                writer.uint32(/* id 10, wireType 0 =*/80).bool(message.adopted);
            if (message.hasCapturedPieceTypeOtherThanOwn != null && Object.hasOwnProperty.call(message, "hasCapturedPieceTypeOtherThanOwn"))
                writer.uint32(/* id 11, wireType 0 =*/88).bool(message.hasCapturedPieceTypeOtherThanOwn);
            if (message.moveCount != null && Object.hasOwnProperty.call(message, "moveCount"))
                writer.uint32(/* id 12, wireType 0 =*/96).uint32(message.moveCount);
            if (message.captureCount != null && Object.hasOwnProperty.call(message, "captureCount"))
                writer.uint32(/* id 13, wireType 0 =*/104).uint32(message.captureCount);
            return writer;
        };

        /**
         * Encodes the specified PieceDataShared message, length delimited. Does not implicitly {@link chess.PieceDataShared.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.PieceDataShared
         * @static
         * @param {chess.IPieceDataShared} message PieceDataShared message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataShared.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PieceDataShared message from the specified reader or buffer.
         * @function decode
         * @memberof chess.PieceDataShared
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.PieceDataShared} PieceDataShared
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataShared.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.PieceDataShared();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.uint32();
                        break;
                    }
                case 2: {
                        message.type = reader.int32();
                        break;
                    }
                case 3: {
                        message.isWhite = reader.bool();
                        break;
                    }
                case 4: {
                        message.justDoubleMoved = reader.bool();
                        break;
                    }
                case 5: {
                        message.kingKiller = reader.bool();
                        break;
                    }
                case 6: {
                        message.kingPawner = reader.bool();
                        break;
                    }
                case 7: {
                        message.queenKiller = reader.bool();
                        break;
                    }
                case 8: {
                        message.queenPawner = reader.bool();
                        break;
                    }
                case 9: {
                        message.adoptedKiller = reader.bool();
                        break;
                    }
                case 10: {
                        message.adopted = reader.bool();
                        break;
                    }
                case 11: {
                        message.hasCapturedPieceTypeOtherThanOwn = reader.bool();
                        break;
                    }
                case 12: {
                        message.moveCount = reader.uint32();
                        break;
                    }
                case 13: {
                        message.captureCount = reader.uint32();
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
         * Decodes a PieceDataShared message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.PieceDataShared
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.PieceDataShared} PieceDataShared
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataShared.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PieceDataShared message.
         * @function verify
         * @memberof chess.PieceDataShared
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PieceDataShared.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                    break;
                }
            if (message.isWhite != null && message.hasOwnProperty("isWhite"))
                if (typeof message.isWhite !== "boolean")
                    return "isWhite: boolean expected";
            if (message.justDoubleMoved != null && message.hasOwnProperty("justDoubleMoved"))
                if (typeof message.justDoubleMoved !== "boolean")
                    return "justDoubleMoved: boolean expected";
            if (message.kingKiller != null && message.hasOwnProperty("kingKiller"))
                if (typeof message.kingKiller !== "boolean")
                    return "kingKiller: boolean expected";
            if (message.kingPawner != null && message.hasOwnProperty("kingPawner"))
                if (typeof message.kingPawner !== "boolean")
                    return "kingPawner: boolean expected";
            if (message.queenKiller != null && message.hasOwnProperty("queenKiller"))
                if (typeof message.queenKiller !== "boolean")
                    return "queenKiller: boolean expected";
            if (message.queenPawner != null && message.hasOwnProperty("queenPawner"))
                if (typeof message.queenPawner !== "boolean")
                    return "queenPawner: boolean expected";
            if (message.adoptedKiller != null && message.hasOwnProperty("adoptedKiller"))
                if (typeof message.adoptedKiller !== "boolean")
                    return "adoptedKiller: boolean expected";
            if (message.adopted != null && message.hasOwnProperty("adopted"))
                if (typeof message.adopted !== "boolean")
                    return "adopted: boolean expected";
            if (message.hasCapturedPieceTypeOtherThanOwn != null && message.hasOwnProperty("hasCapturedPieceTypeOtherThanOwn"))
                if (typeof message.hasCapturedPieceTypeOtherThanOwn !== "boolean")
                    return "hasCapturedPieceTypeOtherThanOwn: boolean expected";
            if (message.moveCount != null && message.hasOwnProperty("moveCount"))
                if (!$util.isInteger(message.moveCount))
                    return "moveCount: integer expected";
            if (message.captureCount != null && message.hasOwnProperty("captureCount"))
                if (!$util.isInteger(message.captureCount))
                    return "captureCount: integer expected";
            return null;
        };

        /**
         * Creates a PieceDataShared message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.PieceDataShared
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.PieceDataShared} PieceDataShared
         */
        PieceDataShared.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.PieceDataShared)
                return object;
            let message = new $root.chess.PieceDataShared();
            if (object.id != null)
                message.id = object.id >>> 0;
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "PIECE_TYPE_PAWN":
            case 0:
                message.type = 0;
                break;
            case "PIECE_TYPE_KNIGHT":
            case 1:
                message.type = 1;
                break;
            case "PIECE_TYPE_BISHOP":
            case 2:
                message.type = 2;
                break;
            case "PIECE_TYPE_ROOK":
            case 3:
                message.type = 3;
                break;
            case "PIECE_TYPE_QUEEN":
            case 4:
                message.type = 4;
                break;
            case "PIECE_TYPE_KING":
            case 5:
                message.type = 5;
                break;
            case "PIECE_TYPE_PROMOTED_PAWN":
            case 6:
                message.type = 6;
                break;
            }
            if (object.isWhite != null)
                message.isWhite = Boolean(object.isWhite);
            if (object.justDoubleMoved != null)
                message.justDoubleMoved = Boolean(object.justDoubleMoved);
            if (object.kingKiller != null)
                message.kingKiller = Boolean(object.kingKiller);
            if (object.kingPawner != null)
                message.kingPawner = Boolean(object.kingPawner);
            if (object.queenKiller != null)
                message.queenKiller = Boolean(object.queenKiller);
            if (object.queenPawner != null)
                message.queenPawner = Boolean(object.queenPawner);
            if (object.adoptedKiller != null)
                message.adoptedKiller = Boolean(object.adoptedKiller);
            if (object.adopted != null)
                message.adopted = Boolean(object.adopted);
            if (object.hasCapturedPieceTypeOtherThanOwn != null)
                message.hasCapturedPieceTypeOtherThanOwn = Boolean(object.hasCapturedPieceTypeOtherThanOwn);
            if (object.moveCount != null)
                message.moveCount = object.moveCount >>> 0;
            if (object.captureCount != null)
                message.captureCount = object.captureCount >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a PieceDataShared message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.PieceDataShared
         * @static
         * @param {chess.PieceDataShared} message PieceDataShared
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PieceDataShared.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.id = 0;
                object.type = options.enums === String ? "PIECE_TYPE_PAWN" : 0;
                object.isWhite = false;
                object.justDoubleMoved = false;
                object.kingKiller = false;
                object.kingPawner = false;
                object.queenKiller = false;
                object.queenPawner = false;
                object.adoptedKiller = false;
                object.adopted = false;
                object.hasCapturedPieceTypeOtherThanOwn = false;
                object.moveCount = 0;
                object.captureCount = 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.chess.PieceType[message.type] === undefined ? message.type : $root.chess.PieceType[message.type] : message.type;
            if (message.isWhite != null && message.hasOwnProperty("isWhite"))
                object.isWhite = message.isWhite;
            if (message.justDoubleMoved != null && message.hasOwnProperty("justDoubleMoved"))
                object.justDoubleMoved = message.justDoubleMoved;
            if (message.kingKiller != null && message.hasOwnProperty("kingKiller"))
                object.kingKiller = message.kingKiller;
            if (message.kingPawner != null && message.hasOwnProperty("kingPawner"))
                object.kingPawner = message.kingPawner;
            if (message.queenKiller != null && message.hasOwnProperty("queenKiller"))
                object.queenKiller = message.queenKiller;
            if (message.queenPawner != null && message.hasOwnProperty("queenPawner"))
                object.queenPawner = message.queenPawner;
            if (message.adoptedKiller != null && message.hasOwnProperty("adoptedKiller"))
                object.adoptedKiller = message.adoptedKiller;
            if (message.adopted != null && message.hasOwnProperty("adopted"))
                object.adopted = message.adopted;
            if (message.hasCapturedPieceTypeOtherThanOwn != null && message.hasOwnProperty("hasCapturedPieceTypeOtherThanOwn"))
                object.hasCapturedPieceTypeOtherThanOwn = message.hasCapturedPieceTypeOtherThanOwn;
            if (message.moveCount != null && message.hasOwnProperty("moveCount"))
                object.moveCount = message.moveCount;
            if (message.captureCount != null && message.hasOwnProperty("captureCount"))
                object.captureCount = message.captureCount;
            return object;
        };

        /**
         * Converts this PieceDataShared to JSON.
         * @function toJSON
         * @memberof chess.PieceDataShared
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PieceDataShared.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PieceDataShared
         * @function getTypeUrl
         * @memberof chess.PieceDataShared
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PieceDataShared.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.PieceDataShared";
        };

        return PieceDataShared;
    })();

    chess.PieceDataForMove = (function() {

        /**
         * Properties of a PieceDataForMove.
         * @memberof chess
         * @interface IPieceDataForMove
         * @property {number|null} [x] PieceDataForMove x
         * @property {number|null} [y] PieceDataForMove y
         * @property {number|Long|null} [seqnum] PieceDataForMove seqnum
         * @property {chess.IPieceDataShared|null} [piece] PieceDataForMove piece
         */

        /**
         * Constructs a new PieceDataForMove.
         * @memberof chess
         * @classdesc Represents a PieceDataForMove.
         * @implements IPieceDataForMove
         * @constructor
         * @param {chess.IPieceDataForMove=} [properties] Properties to set
         */
        function PieceDataForMove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PieceDataForMove x.
         * @member {number} x
         * @memberof chess.PieceDataForMove
         * @instance
         */
        PieceDataForMove.prototype.x = 0;

        /**
         * PieceDataForMove y.
         * @member {number} y
         * @memberof chess.PieceDataForMove
         * @instance
         */
        PieceDataForMove.prototype.y = 0;

        /**
         * PieceDataForMove seqnum.
         * @member {number|Long} seqnum
         * @memberof chess.PieceDataForMove
         * @instance
         */
        PieceDataForMove.prototype.seqnum = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * PieceDataForMove piece.
         * @member {chess.IPieceDataShared|null|undefined} piece
         * @memberof chess.PieceDataForMove
         * @instance
         */
        PieceDataForMove.prototype.piece = null;

        /**
         * Creates a new PieceDataForMove instance using the specified properties.
         * @function create
         * @memberof chess.PieceDataForMove
         * @static
         * @param {chess.IPieceDataForMove=} [properties] Properties to set
         * @returns {chess.PieceDataForMove} PieceDataForMove instance
         */
        PieceDataForMove.create = function create(properties) {
            return new PieceDataForMove(properties);
        };

        /**
         * Encodes the specified PieceDataForMove message. Does not implicitly {@link chess.PieceDataForMove.verify|verify} messages.
         * @function encode
         * @memberof chess.PieceDataForMove
         * @static
         * @param {chess.IPieceDataForMove} message PieceDataForMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataForMove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.y);
            if (message.seqnum != null && Object.hasOwnProperty.call(message, "seqnum"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.seqnum);
            if (message.piece != null && Object.hasOwnProperty.call(message, "piece"))
                $root.chess.PieceDataShared.encode(message.piece, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified PieceDataForMove message, length delimited. Does not implicitly {@link chess.PieceDataForMove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.PieceDataForMove
         * @static
         * @param {chess.IPieceDataForMove} message PieceDataForMove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataForMove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PieceDataForMove message from the specified reader or buffer.
         * @function decode
         * @memberof chess.PieceDataForMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.PieceDataForMove} PieceDataForMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataForMove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.PieceDataForMove();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.x = reader.uint32();
                        break;
                    }
                case 2: {
                        message.y = reader.uint32();
                        break;
                    }
                case 3: {
                        message.seqnum = reader.uint64();
                        break;
                    }
                case 4: {
                        message.piece = $root.chess.PieceDataShared.decode(reader, reader.uint32());
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
         * Decodes a PieceDataForMove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.PieceDataForMove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.PieceDataForMove} PieceDataForMove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataForMove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PieceDataForMove message.
         * @function verify
         * @memberof chess.PieceDataForMove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PieceDataForMove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (!$util.isInteger(message.seqnum) && !(message.seqnum && $util.isInteger(message.seqnum.low) && $util.isInteger(message.seqnum.high)))
                    return "seqnum: integer|Long expected";
            if (message.piece != null && message.hasOwnProperty("piece")) {
                let error = $root.chess.PieceDataShared.verify(message.piece);
                if (error)
                    return "piece." + error;
            }
            return null;
        };

        /**
         * Creates a PieceDataForMove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.PieceDataForMove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.PieceDataForMove} PieceDataForMove
         */
        PieceDataForMove.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.PieceDataForMove)
                return object;
            let message = new $root.chess.PieceDataForMove();
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            if (object.seqnum != null)
                if ($util.Long)
                    (message.seqnum = $util.Long.fromValue(object.seqnum)).unsigned = true;
                else if (typeof object.seqnum === "string")
                    message.seqnum = parseInt(object.seqnum, 10);
                else if (typeof object.seqnum === "number")
                    message.seqnum = object.seqnum;
                else if (typeof object.seqnum === "object")
                    message.seqnum = new $util.LongBits(object.seqnum.low >>> 0, object.seqnum.high >>> 0).toNumber(true);
            if (object.piece != null) {
                if (typeof object.piece !== "object")
                    throw TypeError(".chess.PieceDataForMove.piece: object expected");
                message.piece = $root.chess.PieceDataShared.fromObject(object.piece);
            }
            return message;
        };

        /**
         * Creates a plain object from a PieceDataForMove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.PieceDataForMove
         * @static
         * @param {chess.PieceDataForMove} message PieceDataForMove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PieceDataForMove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.x = 0;
                object.y = 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.seqnum = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.seqnum = options.longs === String ? "0" : 0;
                object.piece = null;
            }
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (typeof message.seqnum === "number")
                    object.seqnum = options.longs === String ? String(message.seqnum) : message.seqnum;
                else
                    object.seqnum = options.longs === String ? $util.Long.prototype.toString.call(message.seqnum) : options.longs === Number ? new $util.LongBits(message.seqnum.low >>> 0, message.seqnum.high >>> 0).toNumber(true) : message.seqnum;
            if (message.piece != null && message.hasOwnProperty("piece"))
                object.piece = $root.chess.PieceDataShared.toObject(message.piece, options);
            return object;
        };

        /**
         * Converts this PieceDataForMove to JSON.
         * @function toJSON
         * @memberof chess.PieceDataForMove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PieceDataForMove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PieceDataForMove
         * @function getTypeUrl
         * @memberof chess.PieceDataForMove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PieceDataForMove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.PieceDataForMove";
        };

        return PieceDataForMove;
    })();

    chess.PieceDataForSnapshot = (function() {

        /**
         * Properties of a PieceDataForSnapshot.
         * @memberof chess
         * @interface IPieceDataForSnapshot
         * @property {number|null} [dx] PieceDataForSnapshot dx
         * @property {number|null} [dy] PieceDataForSnapshot dy
         * @property {chess.IPieceDataShared|null} [piece] PieceDataForSnapshot piece
         */

        /**
         * Constructs a new PieceDataForSnapshot.
         * @memberof chess
         * @classdesc Represents a PieceDataForSnapshot.
         * @implements IPieceDataForSnapshot
         * @constructor
         * @param {chess.IPieceDataForSnapshot=} [properties] Properties to set
         */
        function PieceDataForSnapshot(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PieceDataForSnapshot dx.
         * @member {number} dx
         * @memberof chess.PieceDataForSnapshot
         * @instance
         */
        PieceDataForSnapshot.prototype.dx = 0;

        /**
         * PieceDataForSnapshot dy.
         * @member {number} dy
         * @memberof chess.PieceDataForSnapshot
         * @instance
         */
        PieceDataForSnapshot.prototype.dy = 0;

        /**
         * PieceDataForSnapshot piece.
         * @member {chess.IPieceDataShared|null|undefined} piece
         * @memberof chess.PieceDataForSnapshot
         * @instance
         */
        PieceDataForSnapshot.prototype.piece = null;

        /**
         * Creates a new PieceDataForSnapshot instance using the specified properties.
         * @function create
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {chess.IPieceDataForSnapshot=} [properties] Properties to set
         * @returns {chess.PieceDataForSnapshot} PieceDataForSnapshot instance
         */
        PieceDataForSnapshot.create = function create(properties) {
            return new PieceDataForSnapshot(properties);
        };

        /**
         * Encodes the specified PieceDataForSnapshot message. Does not implicitly {@link chess.PieceDataForSnapshot.verify|verify} messages.
         * @function encode
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {chess.IPieceDataForSnapshot} message PieceDataForSnapshot message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataForSnapshot.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.dx != null && Object.hasOwnProperty.call(message, "dx"))
                writer.uint32(/* id 1, wireType 0 =*/8).sint32(message.dx);
            if (message.dy != null && Object.hasOwnProperty.call(message, "dy"))
                writer.uint32(/* id 2, wireType 0 =*/16).sint32(message.dy);
            if (message.piece != null && Object.hasOwnProperty.call(message, "piece"))
                $root.chess.PieceDataShared.encode(message.piece, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified PieceDataForSnapshot message, length delimited. Does not implicitly {@link chess.PieceDataForSnapshot.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {chess.IPieceDataForSnapshot} message PieceDataForSnapshot message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PieceDataForSnapshot.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PieceDataForSnapshot message from the specified reader or buffer.
         * @function decode
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.PieceDataForSnapshot} PieceDataForSnapshot
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataForSnapshot.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.PieceDataForSnapshot();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.dx = reader.sint32();
                        break;
                    }
                case 2: {
                        message.dy = reader.sint32();
                        break;
                    }
                case 3: {
                        message.piece = $root.chess.PieceDataShared.decode(reader, reader.uint32());
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
         * Decodes a PieceDataForSnapshot message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.PieceDataForSnapshot} PieceDataForSnapshot
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PieceDataForSnapshot.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PieceDataForSnapshot message.
         * @function verify
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PieceDataForSnapshot.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.dx != null && message.hasOwnProperty("dx"))
                if (!$util.isInteger(message.dx))
                    return "dx: integer expected";
            if (message.dy != null && message.hasOwnProperty("dy"))
                if (!$util.isInteger(message.dy))
                    return "dy: integer expected";
            if (message.piece != null && message.hasOwnProperty("piece")) {
                let error = $root.chess.PieceDataShared.verify(message.piece);
                if (error)
                    return "piece." + error;
            }
            return null;
        };

        /**
         * Creates a PieceDataForSnapshot message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.PieceDataForSnapshot} PieceDataForSnapshot
         */
        PieceDataForSnapshot.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.PieceDataForSnapshot)
                return object;
            let message = new $root.chess.PieceDataForSnapshot();
            if (object.dx != null)
                message.dx = object.dx | 0;
            if (object.dy != null)
                message.dy = object.dy | 0;
            if (object.piece != null) {
                if (typeof object.piece !== "object")
                    throw TypeError(".chess.PieceDataForSnapshot.piece: object expected");
                message.piece = $root.chess.PieceDataShared.fromObject(object.piece);
            }
            return message;
        };

        /**
         * Creates a plain object from a PieceDataForSnapshot message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {chess.PieceDataForSnapshot} message PieceDataForSnapshot
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PieceDataForSnapshot.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.dx = 0;
                object.dy = 0;
                object.piece = null;
            }
            if (message.dx != null && message.hasOwnProperty("dx"))
                object.dx = message.dx;
            if (message.dy != null && message.hasOwnProperty("dy"))
                object.dy = message.dy;
            if (message.piece != null && message.hasOwnProperty("piece"))
                object.piece = $root.chess.PieceDataShared.toObject(message.piece, options);
            return object;
        };

        /**
         * Converts this PieceDataForSnapshot to JSON.
         * @function toJSON
         * @memberof chess.PieceDataForSnapshot
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PieceDataForSnapshot.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PieceDataForSnapshot
         * @function getTypeUrl
         * @memberof chess.PieceDataForSnapshot
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PieceDataForSnapshot.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.PieceDataForSnapshot";
        };

        return PieceDataForSnapshot;
    })();

    chess.ServerMovesAndCaptures = (function() {

        /**
         * Properties of a ServerMovesAndCaptures.
         * @memberof chess
         * @interface IServerMovesAndCaptures
         * @property {Array.<chess.IPieceDataForMove>|null} [moves] ServerMovesAndCaptures moves
         * @property {Array.<chess.IPieceCapture>|null} [captures] ServerMovesAndCaptures captures
         */

        /**
         * Constructs a new ServerMovesAndCaptures.
         * @memberof chess
         * @classdesc Represents a ServerMovesAndCaptures.
         * @implements IServerMovesAndCaptures
         * @constructor
         * @param {chess.IServerMovesAndCaptures=} [properties] Properties to set
         */
        function ServerMovesAndCaptures(properties) {
            this.moves = [];
            this.captures = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerMovesAndCaptures moves.
         * @member {Array.<chess.IPieceDataForMove>} moves
         * @memberof chess.ServerMovesAndCaptures
         * @instance
         */
        ServerMovesAndCaptures.prototype.moves = $util.emptyArray;

        /**
         * ServerMovesAndCaptures captures.
         * @member {Array.<chess.IPieceCapture>} captures
         * @memberof chess.ServerMovesAndCaptures
         * @instance
         */
        ServerMovesAndCaptures.prototype.captures = $util.emptyArray;

        /**
         * Creates a new ServerMovesAndCaptures instance using the specified properties.
         * @function create
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {chess.IServerMovesAndCaptures=} [properties] Properties to set
         * @returns {chess.ServerMovesAndCaptures} ServerMovesAndCaptures instance
         */
        ServerMovesAndCaptures.create = function create(properties) {
            return new ServerMovesAndCaptures(properties);
        };

        /**
         * Encodes the specified ServerMovesAndCaptures message. Does not implicitly {@link chess.ServerMovesAndCaptures.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {chess.IServerMovesAndCaptures} message ServerMovesAndCaptures message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerMovesAndCaptures.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.moves != null && message.moves.length)
                for (let i = 0; i < message.moves.length; ++i)
                    $root.chess.PieceDataForMove.encode(message.moves[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.captures != null && message.captures.length)
                for (let i = 0; i < message.captures.length; ++i)
                    $root.chess.PieceCapture.encode(message.captures[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ServerMovesAndCaptures message, length delimited. Does not implicitly {@link chess.ServerMovesAndCaptures.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {chess.IServerMovesAndCaptures} message ServerMovesAndCaptures message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerMovesAndCaptures.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerMovesAndCaptures message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerMovesAndCaptures} ServerMovesAndCaptures
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerMovesAndCaptures.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerMovesAndCaptures();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.moves && message.moves.length))
                            message.moves = [];
                        message.moves.push($root.chess.PieceDataForMove.decode(reader, reader.uint32()));
                        break;
                    }
                case 2: {
                        if (!(message.captures && message.captures.length))
                            message.captures = [];
                        message.captures.push($root.chess.PieceCapture.decode(reader, reader.uint32()));
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
         * Decodes a ServerMovesAndCaptures message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerMovesAndCaptures} ServerMovesAndCaptures
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerMovesAndCaptures.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerMovesAndCaptures message.
         * @function verify
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerMovesAndCaptures.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.moves != null && message.hasOwnProperty("moves")) {
                if (!Array.isArray(message.moves))
                    return "moves: array expected";
                for (let i = 0; i < message.moves.length; ++i) {
                    let error = $root.chess.PieceDataForMove.verify(message.moves[i]);
                    if (error)
                        return "moves." + error;
                }
            }
            if (message.captures != null && message.hasOwnProperty("captures")) {
                if (!Array.isArray(message.captures))
                    return "captures: array expected";
                for (let i = 0; i < message.captures.length; ++i) {
                    let error = $root.chess.PieceCapture.verify(message.captures[i]);
                    if (error)
                        return "captures." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ServerMovesAndCaptures message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerMovesAndCaptures} ServerMovesAndCaptures
         */
        ServerMovesAndCaptures.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerMovesAndCaptures)
                return object;
            let message = new $root.chess.ServerMovesAndCaptures();
            if (object.moves) {
                if (!Array.isArray(object.moves))
                    throw TypeError(".chess.ServerMovesAndCaptures.moves: array expected");
                message.moves = [];
                for (let i = 0; i < object.moves.length; ++i) {
                    if (typeof object.moves[i] !== "object")
                        throw TypeError(".chess.ServerMovesAndCaptures.moves: object expected");
                    message.moves[i] = $root.chess.PieceDataForMove.fromObject(object.moves[i]);
                }
            }
            if (object.captures) {
                if (!Array.isArray(object.captures))
                    throw TypeError(".chess.ServerMovesAndCaptures.captures: array expected");
                message.captures = [];
                for (let i = 0; i < object.captures.length; ++i) {
                    if (typeof object.captures[i] !== "object")
                        throw TypeError(".chess.ServerMovesAndCaptures.captures: object expected");
                    message.captures[i] = $root.chess.PieceCapture.fromObject(object.captures[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a ServerMovesAndCaptures message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {chess.ServerMovesAndCaptures} message ServerMovesAndCaptures
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerMovesAndCaptures.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.moves = [];
                object.captures = [];
            }
            if (message.moves && message.moves.length) {
                object.moves = [];
                for (let j = 0; j < message.moves.length; ++j)
                    object.moves[j] = $root.chess.PieceDataForMove.toObject(message.moves[j], options);
            }
            if (message.captures && message.captures.length) {
                object.captures = [];
                for (let j = 0; j < message.captures.length; ++j)
                    object.captures[j] = $root.chess.PieceCapture.toObject(message.captures[j], options);
            }
            return object;
        };

        /**
         * Converts this ServerMovesAndCaptures to JSON.
         * @function toJSON
         * @memberof chess.ServerMovesAndCaptures
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerMovesAndCaptures.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerMovesAndCaptures
         * @function getTypeUrl
         * @memberof chess.ServerMovesAndCaptures
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerMovesAndCaptures.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerMovesAndCaptures";
        };

        return ServerMovesAndCaptures;
    })();

    chess.ServerStateSnapshot = (function() {

        /**
         * Properties of a ServerStateSnapshot.
         * @memberof chess
         * @interface IServerStateSnapshot
         * @property {number|null} [xCoord] ServerStateSnapshot xCoord
         * @property {number|null} [yCoord] ServerStateSnapshot yCoord
         * @property {number|Long|null} [seqnum] ServerStateSnapshot seqnum
         * @property {Array.<chess.IPieceDataForSnapshot>|null} [pieces] ServerStateSnapshot pieces
         */

        /**
         * Constructs a new ServerStateSnapshot.
         * @memberof chess
         * @classdesc Represents a ServerStateSnapshot.
         * @implements IServerStateSnapshot
         * @constructor
         * @param {chess.IServerStateSnapshot=} [properties] Properties to set
         */
        function ServerStateSnapshot(properties) {
            this.pieces = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerStateSnapshot xCoord.
         * @member {number} xCoord
         * @memberof chess.ServerStateSnapshot
         * @instance
         */
        ServerStateSnapshot.prototype.xCoord = 0;

        /**
         * ServerStateSnapshot yCoord.
         * @member {number} yCoord
         * @memberof chess.ServerStateSnapshot
         * @instance
         */
        ServerStateSnapshot.prototype.yCoord = 0;

        /**
         * ServerStateSnapshot seqnum.
         * @member {number|Long} seqnum
         * @memberof chess.ServerStateSnapshot
         * @instance
         */
        ServerStateSnapshot.prototype.seqnum = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * ServerStateSnapshot pieces.
         * @member {Array.<chess.IPieceDataForSnapshot>} pieces
         * @memberof chess.ServerStateSnapshot
         * @instance
         */
        ServerStateSnapshot.prototype.pieces = $util.emptyArray;

        /**
         * Creates a new ServerStateSnapshot instance using the specified properties.
         * @function create
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {chess.IServerStateSnapshot=} [properties] Properties to set
         * @returns {chess.ServerStateSnapshot} ServerStateSnapshot instance
         */
        ServerStateSnapshot.create = function create(properties) {
            return new ServerStateSnapshot(properties);
        };

        /**
         * Encodes the specified ServerStateSnapshot message. Does not implicitly {@link chess.ServerStateSnapshot.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {chess.IServerStateSnapshot} message ServerStateSnapshot message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerStateSnapshot.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.xCoord != null && Object.hasOwnProperty.call(message, "xCoord"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.xCoord);
            if (message.yCoord != null && Object.hasOwnProperty.call(message, "yCoord"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.yCoord);
            if (message.seqnum != null && Object.hasOwnProperty.call(message, "seqnum"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.seqnum);
            if (message.pieces != null && message.pieces.length)
                for (let i = 0; i < message.pieces.length; ++i)
                    $root.chess.PieceDataForSnapshot.encode(message.pieces[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ServerStateSnapshot message, length delimited. Does not implicitly {@link chess.ServerStateSnapshot.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {chess.IServerStateSnapshot} message ServerStateSnapshot message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerStateSnapshot.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerStateSnapshot message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerStateSnapshot} ServerStateSnapshot
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerStateSnapshot.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerStateSnapshot();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.xCoord = reader.uint32();
                        break;
                    }
                case 2: {
                        message.yCoord = reader.uint32();
                        break;
                    }
                case 3: {
                        message.seqnum = reader.uint64();
                        break;
                    }
                case 4: {
                        if (!(message.pieces && message.pieces.length))
                            message.pieces = [];
                        message.pieces.push($root.chess.PieceDataForSnapshot.decode(reader, reader.uint32()));
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
         * Decodes a ServerStateSnapshot message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerStateSnapshot} ServerStateSnapshot
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerStateSnapshot.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerStateSnapshot message.
         * @function verify
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerStateSnapshot.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.xCoord != null && message.hasOwnProperty("xCoord"))
                if (!$util.isInteger(message.xCoord))
                    return "xCoord: integer expected";
            if (message.yCoord != null && message.hasOwnProperty("yCoord"))
                if (!$util.isInteger(message.yCoord))
                    return "yCoord: integer expected";
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (!$util.isInteger(message.seqnum) && !(message.seqnum && $util.isInteger(message.seqnum.low) && $util.isInteger(message.seqnum.high)))
                    return "seqnum: integer|Long expected";
            if (message.pieces != null && message.hasOwnProperty("pieces")) {
                if (!Array.isArray(message.pieces))
                    return "pieces: array expected";
                for (let i = 0; i < message.pieces.length; ++i) {
                    let error = $root.chess.PieceDataForSnapshot.verify(message.pieces[i]);
                    if (error)
                        return "pieces." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ServerStateSnapshot message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerStateSnapshot} ServerStateSnapshot
         */
        ServerStateSnapshot.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerStateSnapshot)
                return object;
            let message = new $root.chess.ServerStateSnapshot();
            if (object.xCoord != null)
                message.xCoord = object.xCoord >>> 0;
            if (object.yCoord != null)
                message.yCoord = object.yCoord >>> 0;
            if (object.seqnum != null)
                if ($util.Long)
                    (message.seqnum = $util.Long.fromValue(object.seqnum)).unsigned = true;
                else if (typeof object.seqnum === "string")
                    message.seqnum = parseInt(object.seqnum, 10);
                else if (typeof object.seqnum === "number")
                    message.seqnum = object.seqnum;
                else if (typeof object.seqnum === "object")
                    message.seqnum = new $util.LongBits(object.seqnum.low >>> 0, object.seqnum.high >>> 0).toNumber(true);
            if (object.pieces) {
                if (!Array.isArray(object.pieces))
                    throw TypeError(".chess.ServerStateSnapshot.pieces: array expected");
                message.pieces = [];
                for (let i = 0; i < object.pieces.length; ++i) {
                    if (typeof object.pieces[i] !== "object")
                        throw TypeError(".chess.ServerStateSnapshot.pieces: object expected");
                    message.pieces[i] = $root.chess.PieceDataForSnapshot.fromObject(object.pieces[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a ServerStateSnapshot message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {chess.ServerStateSnapshot} message ServerStateSnapshot
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerStateSnapshot.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.pieces = [];
            if (options.defaults) {
                object.xCoord = 0;
                object.yCoord = 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.seqnum = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.seqnum = options.longs === String ? "0" : 0;
            }
            if (message.xCoord != null && message.hasOwnProperty("xCoord"))
                object.xCoord = message.xCoord;
            if (message.yCoord != null && message.hasOwnProperty("yCoord"))
                object.yCoord = message.yCoord;
            if (message.seqnum != null && message.hasOwnProperty("seqnum"))
                if (typeof message.seqnum === "number")
                    object.seqnum = options.longs === String ? String(message.seqnum) : message.seqnum;
                else
                    object.seqnum = options.longs === String ? $util.Long.prototype.toString.call(message.seqnum) : options.longs === Number ? new $util.LongBits(message.seqnum.low >>> 0, message.seqnum.high >>> 0).toNumber(true) : message.seqnum;
            if (message.pieces && message.pieces.length) {
                object.pieces = [];
                for (let j = 0; j < message.pieces.length; ++j)
                    object.pieces[j] = $root.chess.PieceDataForSnapshot.toObject(message.pieces[j], options);
            }
            return object;
        };

        /**
         * Converts this ServerStateSnapshot to JSON.
         * @function toJSON
         * @memberof chess.ServerStateSnapshot
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerStateSnapshot.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerStateSnapshot
         * @function getTypeUrl
         * @memberof chess.ServerStateSnapshot
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerStateSnapshot.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerStateSnapshot";
        };

        return ServerStateSnapshot;
    })();

    chess.Position = (function() {

        /**
         * Properties of a Position.
         * @memberof chess
         * @interface IPosition
         * @property {number|null} [x] Position x
         * @property {number|null} [y] Position y
         */

        /**
         * Constructs a new Position.
         * @memberof chess
         * @classdesc Represents a Position.
         * @implements IPosition
         * @constructor
         * @param {chess.IPosition=} [properties] Properties to set
         */
        function Position(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Position x.
         * @member {number} x
         * @memberof chess.Position
         * @instance
         */
        Position.prototype.x = 0;

        /**
         * Position y.
         * @member {number} y
         * @memberof chess.Position
         * @instance
         */
        Position.prototype.y = 0;

        /**
         * Creates a new Position instance using the specified properties.
         * @function create
         * @memberof chess.Position
         * @static
         * @param {chess.IPosition=} [properties] Properties to set
         * @returns {chess.Position} Position instance
         */
        Position.create = function create(properties) {
            return new Position(properties);
        };

        /**
         * Encodes the specified Position message. Does not implicitly {@link chess.Position.verify|verify} messages.
         * @function encode
         * @memberof chess.Position
         * @static
         * @param {chess.IPosition} message Position message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Position.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.y);
            return writer;
        };

        /**
         * Encodes the specified Position message, length delimited. Does not implicitly {@link chess.Position.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.Position
         * @static
         * @param {chess.IPosition} message Position message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Position.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Position message from the specified reader or buffer.
         * @function decode
         * @memberof chess.Position
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.Position} Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Position.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.Position();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.x = reader.uint32();
                        break;
                    }
                case 2: {
                        message.y = reader.uint32();
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
         * Decodes a Position message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.Position
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.Position} Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Position.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Position message.
         * @function verify
         * @memberof chess.Position
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Position.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            return null;
        };

        /**
         * Creates a Position message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.Position
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.Position} Position
         */
        Position.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.Position)
                return object;
            let message = new $root.chess.Position();
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a Position message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.Position
         * @static
         * @param {chess.Position} message Position
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Position.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.x = 0;
                object.y = 0;
            }
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            return object;
        };

        /**
         * Converts this Position to JSON.
         * @function toJSON
         * @memberof chess.Position
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Position.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Position
         * @function getTypeUrl
         * @memberof chess.Position
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Position.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.Position";
        };

        return Position;
    })();

    chess.ServerInitialState = (function() {

        /**
         * Properties of a ServerInitialState.
         * @memberof chess
         * @interface IServerInitialState
         * @property {boolean|null} [playingWhite] ServerInitialState playingWhite
         * @property {chess.IPosition|null} [position] ServerInitialState position
         * @property {chess.IServerStateSnapshot|null} [snapshot] ServerInitialState snapshot
         */

        /**
         * Constructs a new ServerInitialState.
         * @memberof chess
         * @classdesc Represents a ServerInitialState.
         * @implements IServerInitialState
         * @constructor
         * @param {chess.IServerInitialState=} [properties] Properties to set
         */
        function ServerInitialState(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerInitialState playingWhite.
         * @member {boolean} playingWhite
         * @memberof chess.ServerInitialState
         * @instance
         */
        ServerInitialState.prototype.playingWhite = false;

        /**
         * ServerInitialState position.
         * @member {chess.IPosition|null|undefined} position
         * @memberof chess.ServerInitialState
         * @instance
         */
        ServerInitialState.prototype.position = null;

        /**
         * ServerInitialState snapshot.
         * @member {chess.IServerStateSnapshot|null|undefined} snapshot
         * @memberof chess.ServerInitialState
         * @instance
         */
        ServerInitialState.prototype.snapshot = null;

        /**
         * Creates a new ServerInitialState instance using the specified properties.
         * @function create
         * @memberof chess.ServerInitialState
         * @static
         * @param {chess.IServerInitialState=} [properties] Properties to set
         * @returns {chess.ServerInitialState} ServerInitialState instance
         */
        ServerInitialState.create = function create(properties) {
            return new ServerInitialState(properties);
        };

        /**
         * Encodes the specified ServerInitialState message. Does not implicitly {@link chess.ServerInitialState.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerInitialState
         * @static
         * @param {chess.IServerInitialState} message ServerInitialState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerInitialState.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.playingWhite != null && Object.hasOwnProperty.call(message, "playingWhite"))
                writer.uint32(/* id 1, wireType 0 =*/8).bool(message.playingWhite);
            if (message.position != null && Object.hasOwnProperty.call(message, "position"))
                $root.chess.Position.encode(message.position, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                $root.chess.ServerStateSnapshot.encode(message.snapshot, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ServerInitialState message, length delimited. Does not implicitly {@link chess.ServerInitialState.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerInitialState
         * @static
         * @param {chess.IServerInitialState} message ServerInitialState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerInitialState.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerInitialState message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerInitialState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerInitialState} ServerInitialState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerInitialState.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerInitialState();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.playingWhite = reader.bool();
                        break;
                    }
                case 2: {
                        message.position = $root.chess.Position.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.snapshot = $root.chess.ServerStateSnapshot.decode(reader, reader.uint32());
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
         * Decodes a ServerInitialState message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerInitialState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerInitialState} ServerInitialState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerInitialState.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerInitialState message.
         * @function verify
         * @memberof chess.ServerInitialState
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerInitialState.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.playingWhite != null && message.hasOwnProperty("playingWhite"))
                if (typeof message.playingWhite !== "boolean")
                    return "playingWhite: boolean expected";
            if (message.position != null && message.hasOwnProperty("position")) {
                let error = $root.chess.Position.verify(message.position);
                if (error)
                    return "position." + error;
            }
            if (message.snapshot != null && message.hasOwnProperty("snapshot")) {
                let error = $root.chess.ServerStateSnapshot.verify(message.snapshot);
                if (error)
                    return "snapshot." + error;
            }
            return null;
        };

        /**
         * Creates a ServerInitialState message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerInitialState
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerInitialState} ServerInitialState
         */
        ServerInitialState.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerInitialState)
                return object;
            let message = new $root.chess.ServerInitialState();
            if (object.playingWhite != null)
                message.playingWhite = Boolean(object.playingWhite);
            if (object.position != null) {
                if (typeof object.position !== "object")
                    throw TypeError(".chess.ServerInitialState.position: object expected");
                message.position = $root.chess.Position.fromObject(object.position);
            }
            if (object.snapshot != null) {
                if (typeof object.snapshot !== "object")
                    throw TypeError(".chess.ServerInitialState.snapshot: object expected");
                message.snapshot = $root.chess.ServerStateSnapshot.fromObject(object.snapshot);
            }
            return message;
        };

        /**
         * Creates a plain object from a ServerInitialState message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerInitialState
         * @static
         * @param {chess.ServerInitialState} message ServerInitialState
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerInitialState.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.playingWhite = false;
                object.position = null;
                object.snapshot = null;
            }
            if (message.playingWhite != null && message.hasOwnProperty("playingWhite"))
                object.playingWhite = message.playingWhite;
            if (message.position != null && message.hasOwnProperty("position"))
                object.position = $root.chess.Position.toObject(message.position, options);
            if (message.snapshot != null && message.hasOwnProperty("snapshot"))
                object.snapshot = $root.chess.ServerStateSnapshot.toObject(message.snapshot, options);
            return object;
        };

        /**
         * Converts this ServerInitialState to JSON.
         * @function toJSON
         * @memberof chess.ServerInitialState
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerInitialState.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerInitialState
         * @function getTypeUrl
         * @memberof chess.ServerInitialState
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerInitialState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerInitialState";
        };

        return ServerInitialState;
    })();

    chess.ServerMessage = (function() {

        /**
         * Properties of a ServerMessage.
         * @memberof chess
         * @interface IServerMessage
         * @property {chess.IServerInitialState|null} [initialState] ServerMessage initialState
         * @property {chess.IServerStateSnapshot|null} [snapshot] ServerMessage snapshot
         * @property {chess.IServerMovesAndCaptures|null} [movesAndCaptures] ServerMessage movesAndCaptures
         * @property {chess.IServerValidMove|null} [validMove] ServerMessage validMove
         * @property {chess.IServerInvalidMove|null} [invalidMove] ServerMessage invalidMove
         * @property {chess.IServerPong|null} [pong] ServerMessage pong
         */

        /**
         * Constructs a new ServerMessage.
         * @memberof chess
         * @classdesc Represents a ServerMessage.
         * @implements IServerMessage
         * @constructor
         * @param {chess.IServerMessage=} [properties] Properties to set
         */
        function ServerMessage(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerMessage initialState.
         * @member {chess.IServerInitialState|null|undefined} initialState
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.initialState = null;

        /**
         * ServerMessage snapshot.
         * @member {chess.IServerStateSnapshot|null|undefined} snapshot
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.snapshot = null;

        /**
         * ServerMessage movesAndCaptures.
         * @member {chess.IServerMovesAndCaptures|null|undefined} movesAndCaptures
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.movesAndCaptures = null;

        /**
         * ServerMessage validMove.
         * @member {chess.IServerValidMove|null|undefined} validMove
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.validMove = null;

        /**
         * ServerMessage invalidMove.
         * @member {chess.IServerInvalidMove|null|undefined} invalidMove
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.invalidMove = null;

        /**
         * ServerMessage pong.
         * @member {chess.IServerPong|null|undefined} pong
         * @memberof chess.ServerMessage
         * @instance
         */
        ServerMessage.prototype.pong = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * ServerMessage payload.
         * @member {"initialState"|"snapshot"|"movesAndCaptures"|"validMove"|"invalidMove"|"pong"|undefined} payload
         * @memberof chess.ServerMessage
         * @instance
         */
        Object.defineProperty(ServerMessage.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["initialState", "snapshot", "movesAndCaptures", "validMove", "invalidMove", "pong"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ServerMessage instance using the specified properties.
         * @function create
         * @memberof chess.ServerMessage
         * @static
         * @param {chess.IServerMessage=} [properties] Properties to set
         * @returns {chess.ServerMessage} ServerMessage instance
         */
        ServerMessage.create = function create(properties) {
            return new ServerMessage(properties);
        };

        /**
         * Encodes the specified ServerMessage message. Does not implicitly {@link chess.ServerMessage.verify|verify} messages.
         * @function encode
         * @memberof chess.ServerMessage
         * @static
         * @param {chess.IServerMessage} message ServerMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.initialState != null && Object.hasOwnProperty.call(message, "initialState"))
                $root.chess.ServerInitialState.encode(message.initialState, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.snapshot != null && Object.hasOwnProperty.call(message, "snapshot"))
                $root.chess.ServerStateSnapshot.encode(message.snapshot, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.movesAndCaptures != null && Object.hasOwnProperty.call(message, "movesAndCaptures"))
                $root.chess.ServerMovesAndCaptures.encode(message.movesAndCaptures, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.validMove != null && Object.hasOwnProperty.call(message, "validMove"))
                $root.chess.ServerValidMove.encode(message.validMove, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.invalidMove != null && Object.hasOwnProperty.call(message, "invalidMove"))
                $root.chess.ServerInvalidMove.encode(message.invalidMove, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.pong != null && Object.hasOwnProperty.call(message, "pong"))
                $root.chess.ServerPong.encode(message.pong, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ServerMessage message, length delimited. Does not implicitly {@link chess.ServerMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chess.ServerMessage
         * @static
         * @param {chess.IServerMessage} message ServerMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerMessage message from the specified reader or buffer.
         * @function decode
         * @memberof chess.ServerMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chess.ServerMessage} ServerMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.chess.ServerMessage();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.initialState = $root.chess.ServerInitialState.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.snapshot = $root.chess.ServerStateSnapshot.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.movesAndCaptures = $root.chess.ServerMovesAndCaptures.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.validMove = $root.chess.ServerValidMove.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.invalidMove = $root.chess.ServerInvalidMove.decode(reader, reader.uint32());
                        break;
                    }
                case 6: {
                        message.pong = $root.chess.ServerPong.decode(reader, reader.uint32());
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
         * Decodes a ServerMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chess.ServerMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chess.ServerMessage} ServerMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerMessage message.
         * @function verify
         * @memberof chess.ServerMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.initialState != null && message.hasOwnProperty("initialState")) {
                properties.payload = 1;
                {
                    let error = $root.chess.ServerInitialState.verify(message.initialState);
                    if (error)
                        return "initialState." + error;
                }
            }
            if (message.snapshot != null && message.hasOwnProperty("snapshot")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ServerStateSnapshot.verify(message.snapshot);
                    if (error)
                        return "snapshot." + error;
                }
            }
            if (message.movesAndCaptures != null && message.hasOwnProperty("movesAndCaptures")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ServerMovesAndCaptures.verify(message.movesAndCaptures);
                    if (error)
                        return "movesAndCaptures." + error;
                }
            }
            if (message.validMove != null && message.hasOwnProperty("validMove")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ServerValidMove.verify(message.validMove);
                    if (error)
                        return "validMove." + error;
                }
            }
            if (message.invalidMove != null && message.hasOwnProperty("invalidMove")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ServerInvalidMove.verify(message.invalidMove);
                    if (error)
                        return "invalidMove." + error;
                }
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.chess.ServerPong.verify(message.pong);
                    if (error)
                        return "pong." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ServerMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chess.ServerMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chess.ServerMessage} ServerMessage
         */
        ServerMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.chess.ServerMessage)
                return object;
            let message = new $root.chess.ServerMessage();
            if (object.initialState != null) {
                if (typeof object.initialState !== "object")
                    throw TypeError(".chess.ServerMessage.initialState: object expected");
                message.initialState = $root.chess.ServerInitialState.fromObject(object.initialState);
            }
            if (object.snapshot != null) {
                if (typeof object.snapshot !== "object")
                    throw TypeError(".chess.ServerMessage.snapshot: object expected");
                message.snapshot = $root.chess.ServerStateSnapshot.fromObject(object.snapshot);
            }
            if (object.movesAndCaptures != null) {
                if (typeof object.movesAndCaptures !== "object")
                    throw TypeError(".chess.ServerMessage.movesAndCaptures: object expected");
                message.movesAndCaptures = $root.chess.ServerMovesAndCaptures.fromObject(object.movesAndCaptures);
            }
            if (object.validMove != null) {
                if (typeof object.validMove !== "object")
                    throw TypeError(".chess.ServerMessage.validMove: object expected");
                message.validMove = $root.chess.ServerValidMove.fromObject(object.validMove);
            }
            if (object.invalidMove != null) {
                if (typeof object.invalidMove !== "object")
                    throw TypeError(".chess.ServerMessage.invalidMove: object expected");
                message.invalidMove = $root.chess.ServerInvalidMove.fromObject(object.invalidMove);
            }
            if (object.pong != null) {
                if (typeof object.pong !== "object")
                    throw TypeError(".chess.ServerMessage.pong: object expected");
                message.pong = $root.chess.ServerPong.fromObject(object.pong);
            }
            return message;
        };

        /**
         * Creates a plain object from a ServerMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chess.ServerMessage
         * @static
         * @param {chess.ServerMessage} message ServerMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.initialState != null && message.hasOwnProperty("initialState")) {
                object.initialState = $root.chess.ServerInitialState.toObject(message.initialState, options);
                if (options.oneofs)
                    object.payload = "initialState";
            }
            if (message.snapshot != null && message.hasOwnProperty("snapshot")) {
                object.snapshot = $root.chess.ServerStateSnapshot.toObject(message.snapshot, options);
                if (options.oneofs)
                    object.payload = "snapshot";
            }
            if (message.movesAndCaptures != null && message.hasOwnProperty("movesAndCaptures")) {
                object.movesAndCaptures = $root.chess.ServerMovesAndCaptures.toObject(message.movesAndCaptures, options);
                if (options.oneofs)
                    object.payload = "movesAndCaptures";
            }
            if (message.validMove != null && message.hasOwnProperty("validMove")) {
                object.validMove = $root.chess.ServerValidMove.toObject(message.validMove, options);
                if (options.oneofs)
                    object.payload = "validMove";
            }
            if (message.invalidMove != null && message.hasOwnProperty("invalidMove")) {
                object.invalidMove = $root.chess.ServerInvalidMove.toObject(message.invalidMove, options);
                if (options.oneofs)
                    object.payload = "invalidMove";
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                object.pong = $root.chess.ServerPong.toObject(message.pong, options);
                if (options.oneofs)
                    object.payload = "pong";
            }
            return object;
        };

        /**
         * Converts this ServerMessage to JSON.
         * @function toJSON
         * @memberof chess.ServerMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerMessage
         * @function getTypeUrl
         * @memberof chess.ServerMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chess.ServerMessage";
        };

        return ServerMessage;
    })();

    return chess;
})();

export { $root as default };
