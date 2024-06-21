<div align="center">

# CroissantLLM Excel Translate

[Demo App](https://jerrettdavis.github.io/croissant-excel-translate/)

</div>

## Overview

A small Web App based on [CroissantLLM](https://huggingface.co/croissantllm) and 
[Croissant-Translate](https://github.com/numerique-gouv/croissant-translate), 
running entirely in the browser with WebLLM. Translates data in an Excel Workbook 
from English to French.

- Fully private = No data ever leaves your computer
- Runs in the browser = No server needed and no install needed!
- Works offline
- Easy-to-use interface

This tool is built on top of [WebLLM](https://github.com/mlc-ai/web-llm), a 
package that brings language model inference directly onto web browsers with 
hardware acceleration.

## System Requirements

To run this, you need a modern browser with support for WebGPU. According to 
[caniuse](https://caniuse.com/?search=WebGPU), WebGPU is supported on:

- Google Chrome
- Microsoft Edge
- All Chronium-based browsers
- Firefox Nightly

Safari on MacOS also has experimental support for WebGPU which can be enabled 
through the WebGPU experimental feature.

In addition to WebGPU support, you need to have enough available RAM on your 
device to run the model (~3,5Gb).

You can check if your browser or your device support WebGPU by visiting 
[webgpureport](https://webgpureport.org/).

## Supported model

We use [CroissantLLM](https://huggingface.co/croissantllm), a 1.3B language 
model pretrained on a set of 3T English and French tokens, which runs swiftly 
on consumer-grade local hardware. This model was developed by CentraleSupélec, 
and it takes up 2.7 Gb of storage in the browser's cache.

To use CroissantLLM with WebLLM, the original model was compiled following the 
compilation process of [MLC](https://mlc.ai/). The model was quantized into 
several formats (from q0f32 to q3f16) and you can find all the files of each 
quantized model on Croissant's Hugging Face repository. This web app uses the
CroissantLLM with the half precision model, because it had the best 
performance-to-memory usage ratio.

You can also use another model. To do that, you can compile your own model 
and weights with [MLC LLM](https://github.com/mlc-ai/mlc-llm). Then you just 
need to update [app-config](./src/app-config.ts) with:

- The URL to model artifacts, such as weights and meta-data.
- The URL to web assembly library (i.e. wasm file) that contains the 
  executables to accelerate the model computations.
- The name of the model.

You also need to change the custom prompt added before the user's text in the 
[prompt](./src/prompt.ts) file.

If you need further information, you can check the 
[MLC LLM documentation](https://llm.mlc.ai/docs/deploy/javascript.html) on how 
to add new model weights and libraries to WebLLM.

**Disclaimer**: This example utilizes the chat version of CroissantLLM, that is
specifically fine-tuned for chat interactions rather than translation purposes. 
Hence, you may encounter some limitations or inaccuracies in the translation. 
Additionally, as with any LLM, it's possible to encounter hallucinations or 
inaccuracies in generated text.

## Try it out

You can [try it here](https://jerrettdavis.github.io/croissant-excel-translate/). 
You can also run the project locally and contribute to improve the interface, 
speed up initial model loading time and fix bugs, by following these steps:

### Prerequisite

- NodeJS >= 20 - https://nodejs.org/
- NPM

### Setup & Run The Project

If you're looking to make changes, run the development environment with live 
reload:

```sh
# Clone the repository
git clone https://jerrettdavis.github.io/croissant-excel-translate.git

# Enter the project folder
cd ./croissant-excel-translate

# Install dependencies
npm install

# Start the project for development
npm run dev
```

### Building the project for production

To compile the React code yourself, run:

```sh
# Compile and minify the project for publishing, outputs to `dist/`
npm run build

# Build the project for publishing and preview it locally. Do not use this as 
# a production server as it's not designed for it
npm run preview
```

This repository has a workflow that automatically deploys the site to GitHub 
Pages whenever the main branch is modified

## License

This work is released under the MIT License (see [LICENSE](./LICENSE)).
