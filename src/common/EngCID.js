const CID = require('cids');
const multihash = require('multihashes');
const CIDUtil = require('./CIDUtil');
const EncoderUtil = require('./EncoderUtil');

class EngCID{

    constructor(encoder = EncoderUtil){

        this._encoder = encoder;
        this._cid = null;
    }

    static createFromKeccack256(keccack256Hash){
        let cid = CIDUtil.createCID(keccack256Hash);
        if(cid){
            let engCid = new EngCID();
            engCid._setCID(cid);
            return engCid
        }
        return null;
    }

    static createFromNetwork(encodedB58byteArray){
        let b58 = EncoderUtil.decodeFromNetwork(encodedB58byteArray);
        let cid = CIDUtil.createCIDFromB58(b58);
        if(cid){
            let engCID = new EngCID();
            engCID._setCID(cid);
            return engCID;
        }
        return null;
    }

    getCID(){
        return this._cid;
    }

    /** get the keccack256 hash of a CID
     * @param {Boolean} with0x , if true then add 0x to the result
     * @returns {String} h, a keccak hash representation
     * */
    getKeccack256(with0x = false){
        let h = CIDUtil.getKeccak256FromCID(this._cid);
        if(with0x){
            return '0x' + h;
        }
        return h;
    }

    toBuffer(){
        return this._cid.buffer;
    }

    toB58String(){
        return this._cid.toBaseEncodedString();
    }

    /** Compare if this and other are equal
     * @param {CID} cid - other cid to test
     * @returns {Boolean} true - this.cid == cid , false otherwise*/
    equalCID(cid){
        return this._cid.equals(cid);
    }

    equalKeccack256(keccackHash){

        let cid = CIDUtil.createCID(keccackHash);
        if(cid){
            return this.equalCID(cid);
        }
        return false;
    }

    equalEngCID(engCID){
        if (engCID.constructor.name === 'EngCID'){
            return this.equalCID(engCID.getCID());
        }
        return false;
    }

    /** Encode the CID into a network stream.
     * Steps:
     * 1) b58Str = this.cid
     * 2) e = encode(b58Str), encode with encoder util, currently msgpack
     * 3) b = toBytes(e)
     * 4) return b
     * @returns {Array<Bytes>}
     * */
    encodeToNetwork(){
        return this._encoder.encodeToNetwork(this.toB58String());
    }

    _setCID(cid){
        this._cid = cid;
    }

}

module.exports = EngCID;

// /** examples */
//
// let eth = '0xe8a5770e2c3fa1406d8554a6539335f5d4b82ed50f442a6834149d9122e7f8af';
// let eng = EngCID.createFromKeccack256(eth);
//
// let eth2 = 'e8a5770e2c3fa1406d8554a6539335f5d4b82ed50f442a6834149d9122e7f8af';
// let eng2 = EngCID.createFromKeccack256(eth2);
// let otherCid = new CID(eng2.toB58String());
// console.log("generated "  + eng2.equalCID(otherCid));
// console.log(eng.toB58String());
// console.log(eng.toBuffer());
// console.log(eng.getKeccack256());
//
// console.log(eng.equalCID(eng2.getCID()));
// console.log(eng.equalKeccack256(eth2));
// console.log(eng.equalEngCID(eng2));
// //network encoding this
// let fromNetwork = eng.encodeToNetwork();
// let newCID = EngCID.createFromNetwork(fromNetwork);
// console.log(eng.equalEngCID(newCID));
