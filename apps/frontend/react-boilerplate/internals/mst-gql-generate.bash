#!/usr/bin/env bash

# Generate uniswap-v3 models
yarn mst-gql\
  --force\
  --noReact\
  --format ts\
  --outDir generated/mst-gql/uniswap-v3\
  src/graphql/uniswap-v3.graphql
