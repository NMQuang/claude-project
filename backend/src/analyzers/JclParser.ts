/**
 * JCL Parser
 *
 * Parses .jcl, .prc, .proc files to extract:
 * - Job definitions and step sequences
 * - Program execution order
 * - Dataset (DD) statements
 * - Conditional execution logic
 * - Batch chain flows
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Interfaces
// ============================================================================

export interface JclJobDefinition {
  jobName: string;
  jobClass?: string;
  msgClass?: string;
  region?: string;
  time?: string;
  notify?: string;
  jobDescription?: string;
  steps: JclStep[];
  parameters: JobParameter[];
}

export interface JclStep {
  stepName: string;
  stepNumber: number;
  programName: string;
  procName?: string;
  ddStatements: DDStatement[];
  condition?: StepCondition;
  region?: string;
  time?: string;
  parm?: string;
  isConditional: boolean;
  dependsOnSteps: string[];
}

export interface DDStatement {
  ddName: string;
  disposition?: string;
  datasetName?: string;
  datasetType: 'VSAM' | 'SEQUENTIAL' | 'PDS' | 'SYSOUT' | 'INSTREAM' | 'TEMP' | 'GDG' | 'UNKNOWN';
  accessMode: 'INPUT' | 'OUTPUT' | 'I-O' | 'UNKNOWN';
  recfm?: string;
  lrecl?: number;
  blksize?: number;
  space?: string;
  dcb?: string;
  isTemporary: boolean;
  instreamData?: string[];
}

export interface StepCondition {
  conditionType: 'COND' | 'IF' | 'EVEN' | 'ONLY';
  expression: string;
  checkCode?: number;
  operator?: 'EQ' | 'NE' | 'GT' | 'GE' | 'LT' | 'LE';
  referenceStep?: string;
}

export interface JobParameter {
  name: string;
  value?: string;
  defaultValue?: string;
}

export interface ProcDefinition {
  procName: string;
  parameters: JobParameter[];
  steps: JclStep[];
  description?: string;
}

export interface BatchChainFlow {
  flowName: string;
  jobs: JclJobDefinition[];
  executionOrder: string[];
  dataFlowPaths: DataFlowPath[];
}

export interface DataFlowPath {
  sourceDataset: string;
  targetDataset: string;
  producerStep: string;
  consumerStep: string;
  flowType: 'SEQUENTIAL' | 'PARALLEL';
}

export interface JclAnalysisResult {
  fileName: string;
  filePath: string;
  relativePath?: string;
  fileType: 'JOB' | 'PROC' | 'INCLUDE';
  jobs: JclJobDefinition[];
  procedures: ProcDefinition[];
  programExecutions: ProgramExecution[];
  datasetReferences: DatasetReference[];
  batchFlow: BatchChainFlow | null;
  metrics: JclMetrics;
}

export interface ProgramExecution {
  programName: string;
  stepName: string;
  jobName: string;
  executionOrder: number;
  inputDatasets: string[];
  outputDatasets: string[];
  parameters?: string;
}

export interface DatasetReference {
  datasetName: string;
  ddName: string;
  accessMode: 'INPUT' | 'OUTPUT' | 'I-O' | 'UNKNOWN';
  usedByPrograms: string[];
  usedInSteps: string[];
}

export interface JclMetrics {
  totalLines: number;
  totalSteps: number;
  totalDDStatements: number;
  uniquePrograms: number;
  uniqueDatasets: number;
  conditionalSteps: number;
}

// ============================================================================
// Main Parser Class
// ============================================================================

export class JclParser {
  private lines: string[] = [];
  private currentLineIndex: number = 0;

  /**
   * Parse a JCL file
   */
  async parse(filePath: string): Promise<JclAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.lines = this.preprocessJcl(content);
    this.currentLineIndex = 0;

    const fileName = path.basename(filePath);
    const fileType = this.determineFileType(fileName, this.lines);

    const jobs: JclJobDefinition[] = [];
    const procedures: ProcDefinition[] = [];

    // Parse based on file type
    if (fileType === 'JOB') {
      const job = this.parseJob();
      if (job) jobs.push(job);
    } else if (fileType === 'PROC') {
      const proc = this.parseProc();
      if (proc) procedures.push(proc);
    }

    // Extract program executions
    const programExecutions = this.extractProgramExecutions(jobs);

    // Extract dataset references
    const datasetReferences = this.extractDatasetReferences(jobs);

    // Build batch flow
    const batchFlow = this.buildBatchFlow(jobs);

    // Calculate metrics
    const metrics = this.calculateMetrics(jobs, procedures);

    return {
      fileName,
      filePath,
      fileType,
      jobs,
      procedures,
      programExecutions,
      datasetReferences,
      batchFlow,
      metrics
    };
  }

  /**
   * Preprocess JCL - handle continuations and normalize
   */
  private preprocessJcl(content: string): string[] {
    const rawLines = content.split('\n');
    const processedLines: string[] = [];
    let continuedLine = '';

    for (const line of rawLines) {
      // Remove sequence numbers (columns 73-80 if present)
      let cleanLine = line.length > 72 ? line.substring(0, 72) : line;

      // Handle continuation (line ends with comma or continuation indicator)
      if (continuedLine) {
        // This line continues previous - skip leading // and spaces
        const contPart = cleanLine.replace(/^\/\/\s*/, '').trim();
        continuedLine += ' ' + contPart;

        if (!cleanLine.trim().endsWith(',') && !cleanLine.includes(',')) {
          processedLines.push(continuedLine);
          continuedLine = '';
        }
      } else if (cleanLine.trim().endsWith(',')) {
        continuedLine = cleanLine;
      } else {
        processedLines.push(cleanLine);
      }
    }

    if (continuedLine) {
      processedLines.push(continuedLine);
    }

    return processedLines;
  }

  /**
   * Determine file type from name and content
   */
  private determineFileType(fileName: string, lines: string[]): 'JOB' | 'PROC' | 'INCLUDE' {
    const lowerName = fileName.toLowerCase();

    // Check extension first
    if (lowerName.endsWith('.prc') || lowerName.endsWith('.proc')) {
      return 'PROC';
    }

    // Check content for JOB card
    for (const line of lines) {
      if (line.includes(' JOB ')) {
        return 'JOB';
      }
      if (line.match(/^\/\/[A-Z0-9@#$]+\s+PROC/)) {
        return 'PROC';
      }
    }

    return 'JOB';
  }

  /**
   * Parse a JOB card and its steps
   */
  private parseJob(): JclJobDefinition | null {
    let job: JclJobDefinition | null = null;
    let currentStep: JclStep | null = null;
    let stepNumber = 0;

    while (this.currentLineIndex < this.lines.length) {
      const line = this.lines[this.currentLineIndex];
      const upperLine = line.toUpperCase();

      // Skip comments and empty lines
      if (line.startsWith('//*') || !line.trim()) {
        this.currentLineIndex++;
        continue;
      }

      // JOB card
      const jobMatch = upperLine.match(/^\/\/([A-Z0-9@#$]+)\s+JOB\s*(.*)/);
      if (jobMatch) {
        job = {
          jobName: jobMatch[1],
          steps: [],
          parameters: []
        };
        this.parseJobParameters(job, jobMatch[2]);
        this.currentLineIndex++;
        continue;
      }

      if (!job) {
        this.currentLineIndex++;
        continue;
      }

      // EXEC statement (step)
      const execMatch = upperLine.match(/^\/\/([A-Z0-9@#$]*)\s+EXEC\s+(.*)/);
      if (execMatch) {
        if (currentStep) {
          job.steps.push(currentStep);
        }

        stepNumber++;
        currentStep = this.parseExecStatement(execMatch[1] || `STEP${stepNumber}`, execMatch[2], stepNumber);
        this.currentLineIndex++;
        continue;
      }

      // DD statement
      const ddMatch = upperLine.match(/^\/\/([A-Z0-9@#$]+)\s+DD\s*(.*)/);
      if (ddMatch && currentStep) {
        const dd = this.parseDDStatement(ddMatch[1], ddMatch[2]);
        currentStep.ddStatements.push(dd);
        this.currentLineIndex++;
        continue;
      }

      // IF/ENDIF conditional
      if (upperLine.match(/^\/\/\s*IF\s+/)) {
        // Handle IF statement
        this.currentLineIndex++;
        continue;
      }

      this.currentLineIndex++;
    }

    // Add last step
    if (job && currentStep) {
      job.steps.push(currentStep);
    }

    return job;
  }

  /**
   * Parse job parameters
   */
  private parseJobParameters(job: JclJobDefinition, params: string): void {
    const upperParams = params.toUpperCase();

    // Extract CLASS
    const classMatch = upperParams.match(/CLASS=([A-Z0-9])/);
    if (classMatch) job.jobClass = classMatch[1];

    // Extract MSGCLASS
    const msgClassMatch = upperParams.match(/MSGCLASS=([A-Z0-9])/);
    if (msgClassMatch) job.msgClass = msgClassMatch[1];

    // Extract REGION
    const regionMatch = upperParams.match(/REGION=([0-9]+[KM]?)/);
    if (regionMatch) job.region = regionMatch[1];

    // Extract TIME
    const timeMatch = upperParams.match(/TIME=\(?([0-9,]+)\)?/);
    if (timeMatch) job.time = timeMatch[1];

    // Extract NOTIFY
    const notifyMatch = upperParams.match(/NOTIFY=([A-Z0-9@#$]+)/);
    if (notifyMatch) job.notify = notifyMatch[1];
  }

  /**
   * Parse EXEC statement
   */
  private parseExecStatement(stepName: string, execParams: string, stepNumber: number): JclStep {
    const upperParams = execParams.toUpperCase();

    const step: JclStep = {
      stepName,
      stepNumber,
      programName: 'UNKNOWN',
      ddStatements: [],
      isConditional: false,
      dependsOnSteps: []
    };

    // Check for PGM= (direct program execution)
    const pgmMatch = upperParams.match(/PGM=([A-Z0-9@#$]+)/);
    if (pgmMatch) {
      step.programName = pgmMatch[1];
    }

    // Check for PROC= (procedure call)
    const procMatch = upperParams.match(/(?:PROC=)?([A-Z0-9@#$]+)(?:,|$)/);
    if (procMatch && !pgmMatch) {
      step.procName = procMatch[1];
      step.programName = `PROC:${procMatch[1]}`;
    }

    // Extract PARM
    const parmMatch = execParams.match(/PARM=(['"]?)([^'"]+)\1/);
    if (parmMatch) {
      step.parm = parmMatch[2];
    }

    // Extract COND
    const condMatch = upperParams.match(/COND=\(([^)]+)\)/);
    if (condMatch) {
      step.isConditional = true;
      step.condition = this.parseCondition(condMatch[1]);
    }

    // Extract REGION
    const regionMatch = upperParams.match(/REGION=([0-9]+[KM]?)/);
    if (regionMatch) step.region = regionMatch[1];

    // Extract TIME
    const timeMatch = upperParams.match(/TIME=\(?([0-9,]+)\)?/);
    if (timeMatch) step.time = timeMatch[1];

    return step;
  }

  /**
   * Parse condition expression
   */
  private parseCondition(condExpr: string): StepCondition {
    const condition: StepCondition = {
      conditionType: 'COND',
      expression: condExpr
    };

    // Parse (code,operator) or (code,operator,stepname)
    const condParts = condExpr.split(',');
    if (condParts.length >= 2) {
      condition.checkCode = parseInt(condParts[0]);
      condition.operator = condParts[1].trim() as any;
      if (condParts.length >= 3) {
        condition.referenceStep = condParts[2].trim();
      }
    }

    return condition;
  }

  /**
   * Parse DD statement
   */
  private parseDDStatement(ddName: string, ddParams: string): DDStatement {
    const upperParams = ddParams.toUpperCase();

    const dd: DDStatement = {
      ddName,
      datasetType: 'UNKNOWN',
      accessMode: 'UNKNOWN',
      isTemporary: false
    };

    // Check for SYSOUT
    if (upperParams.includes('SYSOUT=')) {
      dd.datasetType = 'SYSOUT';
      dd.accessMode = 'OUTPUT';
      return dd;
    }

    // Check for instream data
    if (upperParams.trim() === '*' || upperParams.includes('DATA')) {
      dd.datasetType = 'INSTREAM';
      dd.accessMode = 'INPUT';
      dd.instreamData = this.parseInstreamData();
      return dd;
    }

    // Check for DUMMY
    if (upperParams.includes('DUMMY')) {
      dd.datasetType = 'TEMP';
      return dd;
    }

    // Extract DSN
    const dsnMatch = upperParams.match(/DSN(?:AME)?=([A-Z0-9@#$.&()\-+]+)/);
    if (dsnMatch) {
      dd.datasetName = dsnMatch[1];

      // Check if temporary
      if (dd.datasetName.startsWith('&&') || dd.datasetName.startsWith('&')) {
        dd.isTemporary = true;
        dd.datasetType = 'TEMP';
      }

      // Infer dataset type from name
      if (dd.datasetName.includes('.VSAM.') || dd.datasetName.includes('.KSDS.') ||
          dd.datasetName.includes('.ESDS.') || dd.datasetName.includes('.RRDS.')) {
        dd.datasetType = 'VSAM';
      } else if (dd.datasetName.includes('(+') || dd.datasetName.includes('(-')) {
        dd.datasetType = 'GDG';
      }
    }

    // Extract DISP
    const dispMatch = upperParams.match(/DISP=\(?([^)]+)\)?/);
    if (dispMatch) {
      dd.disposition = dispMatch[1];
      dd.accessMode = this.inferAccessMode(dispMatch[1]);
    }

    // Extract DCB parameters
    const recfmMatch = upperParams.match(/RECFM=([A-Z]+)/);
    if (recfmMatch) dd.recfm = recfmMatch[1];

    const lreclMatch = upperParams.match(/LRECL=(\d+)/);
    if (lreclMatch) dd.lrecl = parseInt(lreclMatch[1]);

    const blksizeMatch = upperParams.match(/BLKSIZE=(\d+)/);
    if (blksizeMatch) dd.blksize = parseInt(blksizeMatch[1]);

    // Infer dataset type if not yet determined
    if (dd.datasetType === 'UNKNOWN') {
      if (dd.recfm) {
        dd.datasetType = dd.recfm.includes('F') || dd.recfm.includes('V') ? 'SEQUENTIAL' : 'UNKNOWN';
      }
    }

    return dd;
  }

  /**
   * Infer access mode from DISP parameter
   */
  private inferAccessMode(disp: string): DDStatement['accessMode'] {
    const upperDisp = disp.toUpperCase();

    if (upperDisp.startsWith('NEW') || upperDisp.includes('NEW')) {
      return 'OUTPUT';
    }
    if (upperDisp.includes('MOD')) {
      return 'OUTPUT';
    }
    if (upperDisp.startsWith('OLD') || upperDisp.includes('OLD')) {
      return 'I-O';
    }
    if (upperDisp.startsWith('SHR') || upperDisp.includes('SHR')) {
      return 'INPUT';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse instream data
   */
  private parseInstreamData(): string[] {
    const data: string[] = [];
    this.currentLineIndex++;

    while (this.currentLineIndex < this.lines.length) {
      const line = this.lines[this.currentLineIndex];

      if (line.startsWith('/*') || (line.startsWith('//') && !line.startsWith('//*'))) {
        this.currentLineIndex--;
        break;
      }

      data.push(line);
      this.currentLineIndex++;
    }

    return data;
  }

  /**
   * Parse a PROC definition
   */
  private parseProc(): ProcDefinition | null {
    let proc: ProcDefinition | null = null;
    let currentStep: JclStep | null = null;
    let stepNumber = 0;

    while (this.currentLineIndex < this.lines.length) {
      const line = this.lines[this.currentLineIndex];
      const upperLine = line.toUpperCase();

      // Skip comments
      if (line.startsWith('//*') || !line.trim()) {
        this.currentLineIndex++;
        continue;
      }

      // PROC statement
      const procMatch = upperLine.match(/^\/\/([A-Z0-9@#$]+)\s+PROC\s*(.*)/);
      if (procMatch) {
        proc = {
          procName: procMatch[1],
          parameters: this.parseProcParameters(procMatch[2]),
          steps: []
        };
        this.currentLineIndex++;
        continue;
      }

      if (!proc) {
        this.currentLineIndex++;
        continue;
      }

      // EXEC statement
      const execMatch = upperLine.match(/^\/\/([A-Z0-9@#$]*)\s+EXEC\s+(.*)/);
      if (execMatch) {
        if (currentStep) {
          proc.steps.push(currentStep);
        }

        stepNumber++;
        currentStep = this.parseExecStatement(execMatch[1] || `STEP${stepNumber}`, execMatch[2], stepNumber);
        this.currentLineIndex++;
        continue;
      }

      // DD statement
      const ddMatch = upperLine.match(/^\/\/([A-Z0-9@#$.]+)\s+DD\s*(.*)/);
      if (ddMatch && currentStep) {
        const dd = this.parseDDStatement(ddMatch[1], ddMatch[2]);
        currentStep.ddStatements.push(dd);
        this.currentLineIndex++;
        continue;
      }

      // PEND statement (end of proc)
      if (upperLine.includes(' PEND')) {
        break;
      }

      this.currentLineIndex++;
    }

    if (proc && currentStep) {
      proc.steps.push(currentStep);
    }

    return proc;
  }

  /**
   * Parse PROC parameters
   */
  private parseProcParameters(paramString: string): JobParameter[] {
    const params: JobParameter[] = [];
    const paramPairs = paramString.split(',');

    for (const pair of paramPairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        params.push({
          name: trimmed.substring(0, eqIndex),
          defaultValue: trimmed.substring(eqIndex + 1)
        });
      } else {
        params.push({ name: trimmed });
      }
    }

    return params;
  }

  /**
   * Extract program executions from jobs
   */
  private extractProgramExecutions(jobs: JclJobDefinition[]): ProgramExecution[] {
    const executions: ProgramExecution[] = [];
    let order = 0;

    for (const job of jobs) {
      for (const step of job.steps) {
        if (step.programName.startsWith('PROC:')) continue;

        order++;
        const inputDs: string[] = [];
        const outputDs: string[] = [];

        for (const dd of step.ddStatements) {
          if (dd.datasetName) {
            if (dd.accessMode === 'INPUT') {
              inputDs.push(dd.datasetName);
            } else if (dd.accessMode === 'OUTPUT') {
              outputDs.push(dd.datasetName);
            } else if (dd.accessMode === 'I-O') {
              inputDs.push(dd.datasetName);
              outputDs.push(dd.datasetName);
            }
          }
        }

        executions.push({
          programName: step.programName,
          stepName: step.stepName,
          jobName: job.jobName,
          executionOrder: order,
          inputDatasets: inputDs,
          outputDatasets: outputDs,
          parameters: step.parm
        });
      }
    }

    return executions;
  }

  /**
   * Extract dataset references
   */
  private extractDatasetReferences(jobs: JclJobDefinition[]): DatasetReference[] {
    const datasetMap = new Map<string, DatasetReference>();

    for (const job of jobs) {
      for (const step of job.steps) {
        for (const dd of step.ddStatements) {
          if (!dd.datasetName || dd.isTemporary) continue;

          const key = dd.datasetName;
          if (!datasetMap.has(key)) {
            datasetMap.set(key, {
              datasetName: dd.datasetName,
              ddName: dd.ddName,
              accessMode: dd.accessMode,
              usedByPrograms: [],
              usedInSteps: []
            });
          }

          const ref = datasetMap.get(key)!;
          if (!ref.usedByPrograms.includes(step.programName)) {
            ref.usedByPrograms.push(step.programName);
          }
          if (!ref.usedInSteps.includes(step.stepName)) {
            ref.usedInSteps.push(step.stepName);
          }
        }
      }
    }

    return Array.from(datasetMap.values());
  }

  /**
   * Build batch chain flow
   */
  private buildBatchFlow(jobs: JclJobDefinition[]): BatchChainFlow | null {
    if (jobs.length === 0) return null;

    const executionOrder: string[] = [];
    const dataFlowPaths: DataFlowPath[] = [];

    for (const job of jobs) {
      for (const step of job.steps) {
        executionOrder.push(`${job.jobName}.${step.stepName}`);
      }
    }

    // Build data flow paths
    const producerMap = new Map<string, string>();

    for (const job of jobs) {
      for (const step of job.steps) {
        for (const dd of step.ddStatements) {
          if (dd.datasetName && dd.accessMode === 'OUTPUT') {
            producerMap.set(dd.datasetName, `${job.jobName}.${step.stepName}`);
          }
        }
      }
    }

    for (const job of jobs) {
      for (const step of job.steps) {
        for (const dd of step.ddStatements) {
          if (dd.datasetName && dd.accessMode === 'INPUT' && producerMap.has(dd.datasetName)) {
            dataFlowPaths.push({
              sourceDataset: dd.datasetName,
              targetDataset: dd.datasetName,
              producerStep: producerMap.get(dd.datasetName)!,
              consumerStep: `${job.jobName}.${step.stepName}`,
              flowType: 'SEQUENTIAL'
            });
          }
        }
      }
    }

    return {
      flowName: jobs[0]?.jobName || 'BATCH_FLOW',
      jobs,
      executionOrder,
      dataFlowPaths
    };
  }

  /**
   * Calculate metrics
   */
  private calculateMetrics(jobs: JclJobDefinition[], procedures: ProcDefinition[]): JclMetrics {
    let totalSteps = 0;
    let totalDD = 0;
    const programs = new Set<string>();
    const datasets = new Set<string>();
    let conditionalSteps = 0;

    for (const job of jobs) {
      totalSteps += job.steps.length;
      for (const step of job.steps) {
        totalDD += step.ddStatements.length;
        programs.add(step.programName);
        if (step.isConditional) conditionalSteps++;

        for (const dd of step.ddStatements) {
          if (dd.datasetName && !dd.isTemporary) {
            datasets.add(dd.datasetName);
          }
        }
      }
    }

    for (const proc of procedures) {
      totalSteps += proc.steps.length;
      for (const step of proc.steps) {
        totalDD += step.ddStatements.length;
        programs.add(step.programName);
        if (step.isConditional) conditionalSteps++;
      }
    }

    return {
      totalLines: this.lines.length,
      totalSteps,
      totalDDStatements: totalDD,
      uniquePrograms: programs.size,
      uniqueDatasets: datasets.size,
      conditionalSteps
    };
  }
}
