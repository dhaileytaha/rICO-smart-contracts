const {
    validatorHelper
} = require('../../includes/setup');

const {
    requiresERC1820Instance,
    doFreshDeployment,
    saveSnapshot,
    restoreFromSnapshot,
} = require('../../includes/deployment');

const testKey = "TokensTests";

describe("ReversibleICO - Methods - Tokens", function () {

    const deployingAddress = accounts[0];
    const whitelistingAddress = accounts[1];
    let TokenContractAddress, RICOContractAddress;
    let TokenContractInstance;

    before(async function () {
        requiresERC1820Instance();
        await restoreFromSnapshot("ERC1820_ready");

        const contracts = await doFreshDeployment(testKey, 2, setup.settings);
        this.ReversibleICO = contracts.ReversibleICOInstance;
        TokenContractInstance = contracts.TokenContractInstance;
        TokenContractAddress = TokenContractInstance.receipt.contractAddress;
        RICOContractAddress = this.ReversibleICO.receipt.contractAddress;

        this.jsValidator = new validatorHelper(setup.settings, 
            parseInt( await this.ReversibleICO.methods.getCurrentEffectiveBlockNumber().call(), 10)
        );
    });

    describe("Contract Methods", async function () {

        describe("view getParticipantReservedTokens(address)", async function () {

            const ContributionAmount = new helpers.BN("1").mul( helpers.solidity.etherBN );
            let BuyPhaseStartBlock, BuyPhaseBlockCount, BuyPhaseEndBlock;

            before(async function () {
        
                BuyPhaseStartBlock = await this.ReversibleICO.methods.buyPhaseStartBlock().call();
                BuyPhaseBlockCount = await this.ReversibleICO.methods.buyPhaseBlockCount().call();
                BuyPhaseEndBlock = await this.ReversibleICO.methods.buyPhaseEndBlock().call();

                // move to start of the commit phase
                const currentBlock = await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployingAddress, 0 );

                // send 1 eth contribution
                newContributionTx = await helpers.web3Instance.eth.sendTransaction({
                    from: participant_1,
                    to: RICOContractAddress,
                    value: ContributionAmount.toString(),
                    data: '0x3c7a3aff', // commit()
                    gasPrice: helpers.networkConfig.gasPrice
                });

                let whitelistTx = await this.ReversibleICO.methods.whitelist(
                    [participant_1],
                    true,
                ).send({
                    from: whitelistingAddress
                });

                /*
                 * Validator
                 */

                this.jsValidator.setBlockNumber(currentBlock);
                // set participant initial balance to 100 ETH
                this.jsValidator.BalanceContractInstance.set(
                    participant_1, this.jsValidator.getOneEtherBn().mul(new BN("100"))
                );
                // commit ContributionAmount
                this.jsValidator.commit(participant_1, ContributionAmount);

            });

            describe("participant has no contributions", async function () {

                it("Returns 0 at any stage", async function () {
                    const participantAddress = participant_6;
                    // jump to stage commit start block - 1
                    const stageId = 0;
                    let currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, false, -1);
                    const ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantsTotalStats.reservedTokens;

                    this.jsValidator.setBlockNumber(currentBlock);
                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);

                    let getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    expect(getParticipantReservedTokens).to.be.equal(ContractContributionTokens);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");

                    // jump to stage 12 end block - 1
                    currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, 1);
                    this.jsValidator.setBlockNumber(currentBlock);

                    validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");

                    // jump to stage 12 start block
                    currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, 12);
                    this.jsValidator.setBlockNumber(currentBlock);

                    validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");

                    // jump to stage 12 end block + 1
                    currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, 12, false, 1);
                    this.jsValidator.setBlockNumber(currentBlock);

                    validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");
                });

            });

            describe("participant has made a contribution", async function () {

                const participantAddress = participant_1;

                it("Returns participant's purchased token amount before stage 1 start_block", async function () {

                    // jump to stage commit start block - 1
                    const stageId = 1;
                    const currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, false, -1);
                    this.jsValidator.setBlockNumber(currentBlock);

                    const ParticipantTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantTotalStats.reservedTokens;

                    const getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);
                    expect(getParticipantReservedTokens).to.be.equal(ContractContributionTokens);

                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                });


                it("Returns proper amount at stage 1 start_block", async function () {

                    // jump to stage commit start block
                    const stageId = 1;
                    const currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId);
                    this.jsValidator.setBlockNumber(currentBlock);

                    const ParticipantTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantTotalStats.reservedTokens;

                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    const getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    const validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);

                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                });

                it("Returns proper amount at stage 1 start_block + 1", async function () {

                    // jump to stage commit start block
                    const stageId = 1;
                    const currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, false, 1);
                    this.jsValidator.setBlockNumber(currentBlock);

                    const ParticipantTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantTotalStats.reservedTokens;

                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    const getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    const validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                });

                it("Returns proper amount at stage 6 end_block - 1", async function () {

                    // jump to stage commit start block
                    const stageId = 6;
                    const currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, true, 0);
                    this.jsValidator.setBlockNumber(currentBlock);

                    const ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantsTotalStats.reservedTokens;
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    const getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());

                });

                it("Returns proper amount at stage 12 end_block - 1", async function () {

                    // jump to stage commit start block
                    const stageId = 12;
                    const currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, true, 0);
                    this.jsValidator.setBlockNumber(currentBlock);

                    const ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    const ContractContributionTokens = ParticipantsTotalStats.reservedTokens;
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    const getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());

                });

                it("Returns 0 locked tokens at stage 12 end_block ( also known as BuyPhaseEndBlock )", async function () {

                    // jump to stage commit start block
                    let stageId = 12;
                    let currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, true);
                    this.jsValidator.setBlockNumber(currentBlock);

                    let ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    let ContractContributionTokens = ParticipantsTotalStats.reservedTokens;
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    let getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");
                });

                it("Returns 0 locked tokens after BuyPhaseEndBlock", async function () {

                    // jump to stage commit start block
                    let stageId = 12;
                    let currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, true, 1);
                    this.jsValidator.setBlockNumber(currentBlock);

                    let ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    let ContractContributionTokens = ParticipantsTotalStats.reservedTokens;
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    let getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    let validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");

                    currentBlock = await helpers.utils.jumpToContractStage (this.ReversibleICO, deployingAddress, stageId, true, 1000);
                    this.jsValidator.setBlockNumber(currentBlock);

                    ParticipantsTotalStats = await this.ReversibleICO.methods.participants(participantAddress).call();
                    ContractContributionTokens = ParticipantsTotalStats.reservedTokens;
                    expect(parseInt(ContractContributionTokens)).to.be.above(0);

                    getParticipantReservedTokens = await this.ReversibleICO.methods.getParticipantReservedTokens(participantAddress).call();
                    validatorTokenAmount = this.jsValidator.getParticipantReservedTokens(participantAddress);
                    expect(getParticipantReservedTokens.toString()).to.be.equal(validatorTokenAmount.toString());
                    expect(getParticipantReservedTokens.toString()).to.be.equal("0");
                });
                
            });
            
        });

    });

});