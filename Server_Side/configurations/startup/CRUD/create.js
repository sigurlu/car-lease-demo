'use strict';

let configFile = require(__dirname+'/../../configuration.js');
let tracing = require(__dirname+'/../../../tools/traces/trace.js');


const path = require('path');
let hfc = require('hfc');

function connectToPeers(chain, peers, pem) {
    peers.forEach(function(peer, index) {
        chain.addPeer(configFile.config.hfc_protocol+'://'+peer.discovery_host+':'+peer.discovery_port, {pem:pem});
        console.log('peer'+index+': '+configFile.config.hfc_protocol+'://'+peer.discovery_host+':'+peer.discovery_port);
    });
}

exports.connectToPeers = connectToPeers;

function connectToCA(chain, ca, pem) {
    let membersrvc;
    for (let key in ca) {
        membersrvc = ca[key];
    }
    chain.setMemberServicesUrl(configFile.config.hfc_protocol+'://'+membersrvc.discovery_host+':'+membersrvc.discovery_port, {pem:pem});
    console.log('membersrvc: '+configFile.config.hfc_protocol+'://'+membersrvc.discovery_host+':'+membersrvc.discovery_port);
}

exports.connectToCA = connectToCA;

function enrollRegistrar(chain, username, secret) {
    return new Promise(function(resolve, reject) {
        chain.enroll(username, secret, function(err, registrar) {
            if (!err) {
                tracing.create('INFO', 'Startup', 'Enrolled registrar');
                resolve(registrar);
            } else {
                tracing.create('ERROR', 'Startup', 'Failed to enroll registrar with '+username + ' ' + secret);
                reject(err);
            }
        });
    });
}

exports.enrollRegistrar = enrollRegistrar;

function enrollUser(chain, user) {
    return new Promise(function(resolve, reject) {
        chain.registerAndEnroll(user, function(err, enrolledUser) {
            if (!err){
                        // Successfully enrolled registrar and set this user as the chain's registrar which is authorized to register other users.
                tracing.create('INFO', 'Startup', 'Registrar enroll worked with user '+user.enrollmentID);
                resolve(enrolledUser);
            }
            else{
                tracing.create('INFO', 'Startup', 'Failed to enroll '+user.enrollmentID+' using HFC. Error: '+JSON.stringify(err));
                reject(err);
            }
        });
    });
}

function enrollUsers(chain, users, registrar) {

    let promises = [];
    users.forEach(function (user) {
        user.registrar = registrar;
        promises.push(enrollUser(chain, user));
    });
    return Promise.all(promises);
}

exports.enrollUsers = enrollUsers;

function deployChaincode(enrolledMember, chaincodePath, functionName, args, certPath) {
    return new Promise(function(resolve, reject) {
        let deployRequest = {
            fcn: functionName,
            args: args,
            chaincodePath: chaincodePath
        };
        deployRequest.certificatePath = certPath;

        console.log(deployRequest);

        let transactionContext = enrolledMember.deploy(deployRequest);

        transactionContext.on('submitted', function() {
            console.log('Attempted to deploy chaincode');
        });

        transactionContext.on('complete', function (result) {
            resolve(result);
        });
        transactionContext.on('error', function (error) {
            if (error instanceof hfc.EventTransactionError) {
                reject(new Error(error.msg));
            } else {
                reject(error);
            }
        });
    });
}

exports.deployChaincode = deployChaincode;
