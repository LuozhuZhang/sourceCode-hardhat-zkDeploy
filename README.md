# 源码阅读

* 主要分为两个文件，hardhat和hardhat-zksync-deploy

* zksync-deploy基于hardhat的artifacts，在此基础上重新封装，并兼容了zkEVM

# 注意事项

* 部署合约需要layer1和layer2（zksync）的rpc provider

* 部署的合约必须能够被[zksolc](https://github.com/hedgezhu/zksolc)编译，只是solc或vyper将被拒绝

---

# Source code reading

* Mainly divided into two files, hardhat and hardhat-zksync-deploy

* Zksync deploy is based on hardhat's artifacts, repackaged on this basis, and compatible with zk evm

# Notice

* Deploying the contract requires the rpc provider of layer1 and layer2 (zksync)

* The deployed contract must be able to be compiled by [zksolc](https://github.com/hedgezhu/zksolc), just solc or vyper will be rejected