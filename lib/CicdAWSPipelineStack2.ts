
import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CicdReactAdminDashboardPipelineStack extends Stack {

    private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const codePipeline = new CodePipeline(this, 'Pipeline', {
            pipelineName: "CicdAWSReactAdminDashboardPipeline",
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.gitHub("rooneyviet/reactjs-admin-dashboard-demo", "master"),
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth'
                ]
            }),
            
        })
    }
}