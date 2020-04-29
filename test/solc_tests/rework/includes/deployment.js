
function requiresERC1820Instance() {
    // test requires ERC1820.instance
    if (helpers.ERC1820.instance == false) {
        console.log(helpers.utils.colors.red, "  Error: ERC1820.instance not found, please make sure to run it first.", helpers.utils.colors.none);
        process.exit();
    }
}

async function deployContract(name, args = {}) {
    
    const contractInstance = await helpers.utils.deployNewContractInstance(
        helpers, name, args
    );

    console.log("      Contract deployed:  ", name);
    console.log("        Gas used:         ", contractInstance.receipt.gasUsed);
    console.log("        Contract Address: ", contractInstance.receipt.contractAddress);
    
    return {
        instance: contractInstance,
        receipt: contractInstance.receipt,
        address: contractInstance.receipt.contractAddress
    }
}

async function deployTokenContract() {
   return await deployContract(
       "RicoToken", 
       {
            from: holder,
            arguments: [
                defaultOperators = [], // accounts[0] maybe
            ],
            gas: 6500000,
            gasPrice: helpers.solidity.gwei * 10
        }
    );
}

async function deployRICOContract() {
    return await deployContract("ReversibleICOMock");
}

async function doFreshDeployment(testKey, phase = 0, settings = null ) {

    requiresERC1820Instance();
    const snapShotKey = testKey+"_Phase_"+phase;

    // TestRPC EVM Snapshots allow us to save and restore snapshots at any block
    // we use them to speed up the test runner.

    if (typeof snapshots[snapShotKey] !== "undefined" && snapshotsEnabled) {
        await restoreFromSnapshot(snapShotKey);
    } else {

        if (snapshotsEnabled) {
            if( snapShotKey in dropped ) {
                console.log(helpers.utils.colors.purple, "    * EVM snapshot key ["+snapShotKey+"] was previously used, you may want restore to it instead of a previous one.", helpers.utils.colors.none);
            }
            console.log(helpers.utils.colors.light_blue, "    * EVM snapshot["+snapShotKey+"] start", helpers.utils.colors.none);
        }

        const TokenContract = await deployTokenContract();
        TokenContractInstance = TokenContract.instance;
        TokenContractAddress = TokenContract.address;
        TokenContractReceipt = TokenContract.receipt;

        const RICOContract = await deployRICOContract();
        ReversibleICOInstance = RICOContract.instance;
        ReversibleICOAddress = RICOContract.address;
        ReversibleICOReceipt = RICOContract.receipt;

        // Setup token contract by adding RICO address
        await TokenContractInstance.methods.init(
            ReversibleICOAddress,
            holder, holder,
            setup.settings.token.supply.toString()
        ).send({
            from: holder,  // initial token supply holder
        });

        // phase = 1 -> init RICO with Settings 
        if(phase >= 1 ) {
        
            if(settings == null) {
                throw "Settings cannot be null";
            }

            /*
            *   Add RICO Settings
            */
            currentBlock = await ReversibleICOInstance.methods.getCurrentBlockNumber().call();

            commitPhaseStartBlock = parseInt(currentBlock, 10) + settings.rico.startBlockDelay;

            // 22 days allocation
            commitPhaseBlockCount = settings.rico.blocksPerDay * settings.rico.commitPhaseDays;
            commitPhasePrice = settings.rico.commitPhasePrice;

            // 12 x 30 day periods for distribution
            stageCount = settings.rico.stageCount;
            stageBlockCount = settings.rico.blocksPerDay * settings.rico.stageDays;
            stagePriceIncrease = settings.rico.stagePriceIncrease;

            await ReversibleICOInstance.methods.init(
                TokenContractAddress,       // address _TokenContractAddress
                whitelistingAddress, // address _whitelistingAddress
                projectAddress,       // address _projectAddress
                commitPhaseStartBlock,      // uint256 _commitPhaseStartBlock
                commitPhaseBlockCount,      // uint256 _commitPhaseBlockCount,
                commitPhasePrice,           // uint256 _commitPhasePrice in wei
                stageCount,                 // uint8   _StageCount
                stageBlockCount,            // uint256 _StageBlockCount
                stagePriceIncrease          // uint256 _StagePriceIncrease in wei
            ).send({
                from: deployingAddress,  // deployer
                gas: 3000000
            });
        }

        // phase = 2 -> transfer tokens to rico
        if(phase >= 2 ) {

            // transfer tokens to rico
            await TokenContractInstance.methods.send(
                ReversibleICOInstance.receipt.contractAddress,
                setup.settings.token.sale.toString(),
                web3.utils.sha3('777TestData')
            ).send({
                from: holder,  // initial token supply holder
                gas: 200000
            });

            expect(
                await TokenContractInstance.methods.balanceOf(ReversibleICOAddress).call()
            ).to.be.equal(setup.settings.token.sale.toString());
        }

        // create snapshot
        if (snapshotsEnabled) {
            await saveSnapshot(snapShotKey);
        }
    }

    // reinitialize instances so revert works properly.
    TokenContractInstance = await helpers.utils.getContractInstance(helpers, "RicoToken", TokenContractAddress);
    TokenContractInstance.receipt = TokenContractReceipt;
    ReversibleICOInstance = await helpers.utils.getContractInstance(helpers, "ReversibleICOMock", ReversibleICOAddress);
    ReversibleICOInstance.receipt = ReversibleICOReceipt;
    
    // do some validation
    expect(
        await helpers.utils.getBalance(helpers, ReversibleICOAddress)
    ).to.be.bignumber.equal( new BN(0) );

    let expectedTokenSupply = "0";
    if(phase >= 2 ) {
        expectedTokenSupply = setup.settings.token.sale.toString();
    }

    expect(await TokenContractInstance.methods.balanceOf(ReversibleICOAddress).call()).to.be.equal(expectedTokenSupply);
    expect(
        await ReversibleICOInstance.methods.tokenSupply().call()
    ).to.be.equal(
        await TokenContractInstance.methods.balanceOf(ReversibleICOAddress).call()
    );

    return {
        TokenContractInstance: TokenContractInstance,
        ReversibleICOInstance: ReversibleICOInstance,
    }
};

async function saveSnapshot(_key, log = true) {
    snapshots[_key] = await helpers.web3.evm.snapshot();
    if(log) {
        console.log(helpers.utils.colors.light_blue, "    * EVM snapshot["+_key+"] saved", helpers.utils.colors.none);
    }
}

async function restoreFromSnapshot(_key, log = true) {
    if(_key == "") {
        throw "Restore key cannot be null";
    }

    // restoring from a snapshot purges all later snapshots in testrpc, we do the same
    for (const [key, value] of Object.entries(snapshots)) {
        if(value > snapshots[_key]) {
            dropped[key] = value;
            delete(snapshots[key]);
        }
    }

    if(log) {
        console.log(helpers.utils.colors.light_cyan, "    * EVM snapshot["+_key+"] restored", helpers.utils.colors.none);
    }
    // restore snapshot
    await helpers.web3.evm.revert(snapshots[_key]);
    // save again because whomever wrote test rpc had the impression no one would ever restore twice.. WHY?!
    // @TODO: not having to do this would speed up testing.. so a PR for this to ganache would be nice.
    snapshots[_key] = await helpers.web3.evm.snapshot();
    // reset account nonces..
    helpers.utils.resetAccountNonceCache(helpers);
}

module.exports = {
    requiresERC1820Instance,
    doFreshDeployment,
    saveSnapshot,
    restoreFromSnapshot
};