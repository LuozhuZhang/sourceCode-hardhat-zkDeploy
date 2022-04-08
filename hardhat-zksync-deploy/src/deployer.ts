// * hardhat核心代码
// * Hardhat core code
// https://hardhat.org/advanced/hardhat-runtime-environment.html
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as zk from 'zksync-web3';
import * as ethers from 'ethers';

// * 重新封装了hardhat的Artifact部署文件，增加了zkEVM sourceMapping，从而将合约部署到zksync的layer2网络上
// * Repackaged the Artifact deployment file of hardhat and added zkEVM sourceMapping to deploy the contract to the layer2 network of zksync
import { ZkSyncArtifact } from './types';
import { pluginError } from './helpers';

const ARTIFACT_FORMAT_VERSION = 'hh-zksolc-artifact-1';
const SUPPORTED_L1_TESTNETS = ['mainnet', 'rinkeby', 'ropsten', 'kovan', 'goerli'];

/**
 * An entity capable of deploying contracts to the zkSync network.
 */
export class Deployer {
    public hre: HardhatRuntimeEnvironment;
    public ethWallet: ethers.Wallet;
    public zkWallet: zk.Wallet;

    constructor(hre: HardhatRuntimeEnvironment, zkWallet: zk.Wallet) {
        this.hre = hre;

        // Initalize two providers: one for the Ethereum RPC (layer 1), and one for the zkSync RPC (layer 2). We will need both.
        // * 部署layer2的时候，同时需要layer1和layer2的provider
        // * When deploying layer2, both layer1 and layer2 providers are required
        const ethNetwork = hre.config.zkSyncDeploy.ethNetwork;
        const ethWeb3Provider = SUPPORTED_L1_TESTNETS.includes(ethNetwork)
            ? ethers.getDefaultProvider(ethNetwork)
            : new ethers.providers.JsonRpcProvider(ethNetwork);
        const zkWeb3Provider = new zk.Provider(hre.config.zkSyncDeploy.zkSyncNetwork);

        this.zkWallet = zkWallet.connect(zkWeb3Provider).connectToL1(ethWeb3Provider);
        this.ethWallet = this.zkWallet.ethWallet();
    }

    static fromEthWallet(hre: HardhatRuntimeEnvironment, ethWallet: ethers.Wallet) {
        return new Deployer(hre, new zk.Wallet(ethWallet.privateKey));
    }

    /**
     * Loads an artifact and verifies that it was compiled by `zksolc`.
     *
     * @param contractNameOrFullyQualifiedName The name of the contract.
     *   It can be a contract bare contract name (e.g. "Token") if it's
     *   unique in your project, or a fully qualified contract name
     *   (e.g. "contract/token.sol:Token") otherwise.
     *
     * @throws Throws an error if a non-unique contract name is used,
     *   indicating which fully qualified names can be used instead.
     *
     * @throws Throws an error if an artifact was not compiled by `zksolc`.
     */
    // * 将部署合约传入，确认合约可以被zksolc编译，而不是solc和vyper
    // * zksolc可以单独封装为一个工具，之后有兴趣可以研究一下：https://github.com/matter-labs/hardhat-zksync/tree/main/packages/hardhat-zksync-solc

    // * Pass in the deployment contract and confirm that the contract can be compiled by zksolc instead of solc and vyper
    // * Zksolc can be individually packaged as a tool, and you can study it later if you are interested：https://github.com/matter-labs/hardhat-zksync/tree/main/packages/hardhat-zksync-solc
    public async loadArtifact(contractNameOrFullyQualifiedName: string): Promise<ZkSyncArtifact> {
        const artifact = await this.hre.artifacts.readArtifact(contractNameOrFullyQualifiedName);

        // Verify that this artifact was compiled by the zkSync compiler, and not `solc` or `vyper`.
        if (artifact._format !== ARTIFACT_FORMAT_VERSION) {
            throw pluginError(`Artifact ${contractNameOrFullyQualifiedName} was not compiled by zksolc`);
        }
        return artifact as ZkSyncArtifact;
    }

    /**
     * Estimates the price of calling a deploy transaction in a certain fee token.
     *
     * @param artifact The previously loaded artifact object.
     * @param constructorArguments List of arguments to be passed to the contract constructor.
     * @param feeToken Address of the token to pay fees in. If not provided, defaults to ETH.
     *
     * @returns Calculated fee in wei of the corresponding fee token.
     */
    public async estimateDeployFee(
        artifact: ZkSyncArtifact,
        constructorArguments: any[],
        feeToken?: string
    ): Promise<ethers.BigNumber> {
        const factoryDeps = await this.extractFactoryDeps(artifact);
        const factory = new zk.ContractFactory(artifact.abi, artifact.bytecode, this.zkWallet);

        // Encode deploy transaction so it can be estimated.
        // * 编码，计算部署合约需要花费的gas
        // * Code, calculate the gas cost to deploy the contract
        const deployTx = factory.getDeployTransaction(...constructorArguments, {
            customData: {
                factoryDeps,
                feeToken: feeToken ?? zk.utils.ETH_ADDRESS,
            },
        });
        deployTx.from = this.zkWallet.address;

        // * estimateGas用来计算需要花费的gas
        // * EIP712 用于钱包签署交易的协议：https://eips.ethereum.org/EIPS/eip-712

        // * Estimate gas is used to calculate the gas that needs to be spent
        // * EIP712 Protocol for wallets to sign transactions: https://eips.ethereum.org/EIPS/eip-712
        const gas = await this.zkWallet.provider.estimateGas(deployTx);
        const gasPrice = await this.zkWallet.provider.getGasPrice();

        return gas.mul(gasPrice);
    }

    /**
     * Sends a deploy transaction to the zkSync network.
     * For now, it will use defaults for the transaction parameters:
     * - fee amount is requested automatically from the zkSync server.
     *
     * @param artifact The previously loaded artifact object.
     * @param constructorArguments List of arguments to be passed to the contract constructor.
     * @param feeToken Address of the token to pay fees in. If not provided, defaults to ETH.
     *
     * @returns A contract object.
     */
    public async deploy(
        artifact: ZkSyncArtifact,
        constructorArguments: any[],
        feeToken?: string
    ): Promise<zk.Contract> {
        const factoryDeps = await this.extractFactoryDeps(artifact);
        const factory = new zk.ContractFactory(artifact.abi, artifact.bytecode, this.zkWallet);

        // Encode and send the deploy transaction providing both fee token and factory dependencies.
        const contract = await factory.deploy(...constructorArguments, {
            customData: {
                factoryDeps,
                feeToken: feeToken ?? zk.utils.ETH_ADDRESS,
            },
        });
        // * 向zksync的网络发送部署合约的交易，zksync 2.0？
        // * Send a transaction to deploy a contract to zksync's network, zksync 2.0?
        await contract.deployed();

        return contract;
    }

    /**
     * Extracts factory dependencies from the artifact.
     *
     * @param artifact Artifact to extract dependencies from
     *
     * @returns Factory dependencies in the format expected by SDK.
     */
    async extractFactoryDeps(artifact: ZkSyncArtifact): Promise<string[]> {
        // Load all the dependency bytecodes.
        // We transform it into an array of bytecodes.
        // * 把contract需要的相关依赖（factoryDeps）也转码为了bytecode
        // * Convert the relevant dependencies (factory deps) required by the contract to bytecode
        const factoryDeps: string[] = [];
        for (const dependencyHash in artifact.factoryDeps) {
            const dependencyContract = artifact.factoryDeps[dependencyHash];
            const dependencyBytecodeString = (await this.hre.artifacts.readArtifact(dependencyContract)).bytecode;
            factoryDeps.push(dependencyBytecodeString);
        }

        return factoryDeps;
    }
}
