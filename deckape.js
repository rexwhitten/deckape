#!/usr/bin/env node

const { exec } = require('child_process');
const { Command } = require('commander');
const program = new Command();

const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${command}\n${stderr}`);
                reject(error);
            } else {
                console.log(`Command executed successfully: ${command}\n${stdout}`);
                resolve(stdout);
            }
        });
    });
};

const deleteContainer = async (containerName, containerTag) => {
    try {
        console.log('Killing and deleting container...');
        await runCommand(`docker ps -aq --filter ancestor=${containerName}:${containerTag} | xargs -r docker kill`);
        await runCommand(`docker ps -aq --filter ancestor=${containerName}:${containerTag} | xargs -r docker rm`);
        console.log('Container killed and deleted successfully.');
    } catch (error) {
        console.error('Failed to kill and delete container:', error);
    }
};

const rebuildContainer = async (containerName, containerTag) => {
    try {
        console.log('Stopping container...');
        await runCommand(`docker ps -aq --filter ancestor=${containerName}:${containerTag} | xargs -r docker stop`);

        console.log('Building container...');
        await runCommand(`docker build -t ${containerName}:${containerTag} .`);

        console.log('Starting container...');
        await runCommand(`docker run --platform linux/amd64 -p 9000:8080 ${containerName}:${containerTag}`);

        console.log('Container rebuilt and started successfully.');
    } catch (error) {
        console.error('Failed to rebuild container:', error);
    }
};

const publishToECR = async (containerName, containerTag) => {
    const region = 'us-east-1';
    const accountId = "123456789012";
    const repositoryName = containerName;
    const ecrUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}`;

    try {
        console.log('Logging in to AWS ECR...');
        await runCommand(`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${accountId}.dkr.ecr.${region}.amazonaws.com`);

        console.log('Creating ECR repository if it does not exist...');
        await runCommand(`aws ecr create-repository --repository-name ${repositoryName} --region ${region} --image-scanning-configuration scanOnPush=true --image-tag-mutability IMMUTABLE || true`);

        console.log('Tagging Docker image...');
        await runCommand(`docker tag ${containerName}:${containerTag} ${ecrUri}:latest`);

        console.log('Pushing Docker image to ECR...');
        await runCommand(`docker push ${ecrUri}:latest`);

        console.log('Docker image pushed to ECR successfully.');
    } catch (error) {
        console.error('Failed to publish Docker image to ECR:', error);
    }
};

program
    .name('deckape')
    .description('CLI tool for managing local container development lifecycle workflows for locally developing containerized serverless functions.')
    .version('1.0.0');

program
    .command('delete')
    .description('Delete containers and images')
    .argument('<containerName>', 'Name of the container')
    .argument('<containerTag>', 'Tag of the container')
    .action((containerName, containerTag) => {
        deleteContainer(containerName, containerTag);
    });

program
    .command('rebuild')
    .description('Rebuild and start the container')
    .argument('<containerName>', 'Name of the container')
    .argument('<containerTag>', 'Tag of the container')
    .action((containerName, containerTag) => {
        rebuildContainer(containerName, containerTag);
    });

program
    .command('publish')
    .description('Publish the container to AWS ECR')
    .argument('<containerName>', 'Name of the container')
    .argument('<containerTag>', 'Tag of the container')
    .action((containerName, containerTag) => {
        publishToECR(containerName, containerTag);
    });

program.parse(process.argv);
