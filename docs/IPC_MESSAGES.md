# Communication type
`enigma-core` and `enigma-p2p` communicate via `zeromq` architechture.
The communication is done with `REQ` and `REP` sockets.
`enigma-p2p` is the `REQ` (requester) and `enigma-core` is the `REP` (responder).

# Message type

## Enclave identity related

### `GetRegistrationParams` message
Request:

```
{
    id : <unique_request_id>,
    type : GetRegistrationParams
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetRegistrationParams,
    result : {
        signingKey : hex,
        quote : base64
    }
}
```

### `IdentityChallenge` message

Request:

```
{
    id : <unique_request_id>,
    type : IdentityChallenge,
    nonce :
}
```
Response:
```
{
    id : <unique_request_id>,
    type : IdentityChallenge,
    result : {
        nonce : hex,
        signature : hex
    }
}
```
## Enclave Read only Database related

### `GetTip` message
Request:
```
{
    id : <unique_request_id>,
    type : GetTip,
    input : [Secret Contract Address]
}
```
Response:
```
{
   id : <unique_request_id>,
   type : GetTip,
   result : {
       key : [],
       delta : []
   }
}
```
### `GetTips` message

Request:
```
{
    id : <unique_request_id>,
    type : GetTips,
    input : [Array<Secret Contract Address>]
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetTips,
    result : {
        tips : [Array<{address,key,delta}>]
    }
}
```
### `GetAllTips` message
Request:
```
{
    id : <unique_request_id>,
    type : GetAllTips
}
```
Response:
```
{
    id : <unique_request_id>,
    type: GetAllTips,
    result : {
        tips : [Array<{address,key,delta}>]
    }
}
```
### `GetAllAddrs` message
Request:
```
{
    id : <unique_request_id>,
    type : GetAllAddrs
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetAllAddrs,
    result : {
        addresses : [Array<Secret contract Addrs>]
    }
}
```
### `GetDelta` message
Request:
```
{
    id : <unique_request_id>,
    type : GetDelta,
    input : [{address, key}]
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetDelta,
    result : {
        delta : []
    }
}
```
### `GetDeltas` message
Request:
```
{
    id : <unique_request_id>,
    type : GetDeltas,
    input : [{address, from:key, to:key}, ...]
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetDeltas,
    result : {
        deltas : [{address, key, data},...]
    }
}
```
### `GetContract` message
Request:
```
{
    id : <unique_request_id>,
    type : GetContract,
    input : address
}
```
Response:
```
{
    id : <unique_request_id>,
    type : GetContract,
    result : {
        bytecode : []
    }
}
```

## Enclave Write only Database related

### `UpdateNewContract` message
Request:
```
{
    id : <unique_request_id>,
    type : UpdateNewContract,
    address : ...,
    bytecode : [Secret Contract Address]
}
```
Response:
```
{
    id : <unique_request_id>,
    type : UpdateNewContract,
    address : ...,
    result : {
        status : 0 or err code
    }
}
```

### `UpdateDeltas` message
Request:
```
{
    id : <unique_request_id>,
    type : UpdateDeltas,
    deltas : [{address, key, data : []}, ...]
}
```
Response:
```
{
    id : <unique_request_id>,
    type : UpdateDeltas,
    result : {
        status: 0 or err code,
        errors: [{address,key,status : }, ...]
    }
}
```

## Master Node Key-Exchange related

## Computation related

### `NewTaskEncryptionKey` message

The result of the rpc call `GetWorkerEncryptionKey`.

Request:
```
{
    id : <unique_request_id>,
    type : NewTaskEncryptionKey,
    userPubKey: 'the-user-dh-pubkey'
}
```

Response:

```
{
    id: <unique_request_id>,
    type: NewTaskEncryptionKey,
    result : {
        workerEncryptionKey : 'some-encryption-key',
        workerSig : 'sign(response params)'
    }
}
```

### `DeploySecretContract` messages

### `ComputeTask` message
