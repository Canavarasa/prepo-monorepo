SHARED_CONTRACTS="./packages/prepo-shared-contracts"
HARDHAT="./packages/prepo-hardhat"
TOKEN="./apps/smart-contracts/token"
CORE="./apps/smart-contracts/core"

run() {
    yarn --cwd $1 $2
    status=$?
    if [ $status -eq 1 ]
    then
        exit 1
    fi
}

# core
run $CORE "c"
run $CORE "l"

# token
run $TOKEN "c"
run $TOKEN "l"

# prepo-shared-contracts
run $SHARED_CONTRACTS "c"
run $SHARED_CONTRACTS "l"

# prepo-hardhat
run $HARDHAT "l"
