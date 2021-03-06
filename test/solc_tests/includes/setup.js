global.helpers = setup.helpers;
global.BN = helpers.BN;
global.MAX_UINT256 = helpers.MAX_UINT256;
global.expect = helpers.expect

global.deployingAddress = accounts[0];
global.whitelistingAddress = accounts[1];

global.holder = accounts[10];
global.projectAddress = holder;

global.participant_1 = accounts[4];
global.participant_2 = accounts[5];
global.participant_3 = accounts[6];
global.participant_4 = accounts[7];
global.participant_5 = accounts[8];
global.participant_6 = accounts[9];


global.TransferTypes = {
    NOT_SET:0,
    AUTOMATIC_REFUND:1,
    WHITELIST_REJECTED:2,
    CONTRIBUTION_CANCELED:3,
    PARTICIPANT_WITHDRAW:4,
    PROJECT_WITHDRAWN:5
}

global.snapshotsEnabled = true;
global.snapshots = {};
global.dropped = {};

const _ = require('lodash');
function clone(_what) {
    return _.cloneDeep(_what);
}

const validatorHelper = require("../../js_validator_tests/assets/ricoContract.js");

module.exports = {
    validatorHelper,
    clone
};
