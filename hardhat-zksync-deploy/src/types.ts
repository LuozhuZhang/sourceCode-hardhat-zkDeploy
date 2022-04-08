import { Artifact } from 'hardhat/types';

/**
 * Configuration for zkSync deploy plugin.
 */
export interface ZkDeployConfig {
    /**
     * Identifier of the zkSync network.
     * Can be set to the RPC address of network (e.g. `http://127.0.0.1:3030`).
     * Network IDs like `mainnet` or `rinkeby` will be supported in the future.
     */
    zkSyncNetwork: string;
    /**
     * Identifier of the Ethereum network.
     * Can be set either to the RPC address of network (e.g. `http://127.0.0.1:3030`)
     * or the network ID (e.g. `mainnet` or `rinkeby`).
     */
    ethNetwork: string;
}

/**
 * Description of the factory dependencies of a contract.
 * Dependencies are contracts that can be deployed by this contract via `CREATE` operation.
 */
export interface FactoryDeps {
    // * mapping了contract的hash和bytecode，在EVM上部署合约的逻辑
    // * solc将solidity代码转换成EVM能够理解的bytecode，驱动EVM的运行和以太坊状态转换：https://medium.com/@eiki1212/explaining-ethereum-contract-abi-evm-bytecode-6afa6e917c3b
    // * 通过 CREATE（0xf0）opcode创建合约：https://github.com/crytic/evm-opcodes

    // * Map the hash and bytecode of the contract, and deploy the logic of the contract on the EVM
    // * solc converts solidity code into bytecode that EVM can understand, driving EVM operation and Ethereum state transition: https://medium.com/@eiki1212/explaining-ethereum-contract-abi-evm-bytecode-6afa6e917c3b
    // * Create contract via CREATE (0xf0) opcode: https://github.com/crytic/evm-opcodes

    // A mapping from the contract hash to the contract bytecode.
    [contractHash: string]: string;
}

export interface ZkSyncArtifact extends Artifact {
    // List of factory dependencies of a contract.
    factoryDeps: FactoryDeps;
    // Mapping from the bytecode to the zkEVM assembly (used for tracing).

    // * 理论上source mapping是将contract instruction（opcode）映射到合约的代码片段
    // * 在这里将合约的bytecode映射到了zkEVM，说明是zkEVM执行这个代码片段，也说明zkSync2.0基于zkEVM，后者值得研究

    // * In theory, source mapping is a code fragment that maps a contract instruction (opcode) to a contract
    // * Here, the bytecode of the contract is mapped to zk evm, indicating that zk evm executes this code fragment, and that zk sync2.0 is based on zk evm, which is worth studying
    sourceMapping: string;
}
