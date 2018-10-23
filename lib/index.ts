import { Parser } from './parser/parser';
import { OFile, OIf, OAssignment, OForLoop } from './parser/objects';
import { RangeCompatible, Point, TextEditor, PointCompatible } from 'atom'

export function activate() {
  // Fill something here, optional
}

export function deactivate() {
  // Fill something here, optional
}
export class VhdlLinter {
  messages: Message[] = [];
  tree: OFile;
  constructor(private editorPath: string, private text: string) {
    let parser = new Parser(this.text, this.editorPath);
    this.tree = parser.parse();

  }
  checkAll() {
    this.checkResets();
    // this.checkUnused();
    this.checkUndefineds();
    return this.messages;
  }
  checkUndefineds() {
    for (const process of this.tree.architecture.processes) {
      for (const write of process.getFlatWrites()) {
        let found = false;
        for (const signal of this.tree.architecture.signals) {
          if (signal.name.toLowerCase() === write.text.toLowerCase()) {
            found = true;
          }
        }
        for (const variable of process.variables) {
          if (variable.name.toLowerCase() === write.text.toLowerCase()) {
            found = true;
          }
        }
        for (const port of this.tree.entity.ports) {
          if (port.direction === 'out' || port.direction === 'inout') {
            if (port.name.toLowerCase() === write.text.toLowerCase()) {
              found = true;
            }
          }
        }
        if (!found) {
          let positionStart = this.getPositionFromI(write.begin);
          let positionEnd = this.getPositionFromI(write.end);
          let position: RangeCompatible = [positionStart, positionEnd];

          this.messages.push({
            location: {
              file: this.editorPath,
              position
            },
            severity: 'error',
            excerpt: `signal '${write.text}' is written but not declared`
          })
        }
      }
      for (const read of process.getFlatReads()) {
        let found = false;
        for (const signal of this.tree.architecture.signals) {
          if (signal.name.toLowerCase() === read.text.toLowerCase()) {
            found = true;
          }
        }
        for (const variable of process.variables) {
          if (variable.name.toLowerCase() === read.text.toLowerCase()) {
            found = true;
          }
        }
        for (const port of this.tree.entity.ports) {
          if (port.name.toLowerCase() === read.text.toLowerCase()) {
            found = true;
          }
        }
        let parent = read.parent;
        while ((parent instanceof OFile) === false) {
          if (parent.variables) {
            for (const variable of parent.variables) {
              if (variable.name.toLowerCase() === read.text) {
                found = true;
              }
            }
          } else if (parent instanceof OForLoop) {
            if (parent.variable.toLowerCase() === read.text) {
              found = true;
            }
          }
          parent = parent.parent;
        }
        if (!found) {
          let positionStart = this.getPositionFromI(read.begin);
          let positionEnd = this.getPositionFromI(read.end);
          let position: RangeCompatible = [positionStart, positionEnd];

          this.messages.push({
            location: {
              file: this.editorPath,
              position
            },
            severity: 'error',
            excerpt: `signal '${read.text}' is read but not declared`
          })
        }
      }
    }
  }
  checkResets() {
    for (const signal of this.tree.architecture.signals) {
      if (signal.isRegister() === false) {
        continue;
      }
      let resetFound = false;
      for (const process of this.tree.architecture.processes) {
        if (process.isRegisterProcess()) {
          for (const reset of process.getResets()) {
            if (reset.toLowerCase() === signal.name.toLowerCase()) {
              resetFound = true;
            }
          }
        }
      }
      const registerProcess = signal.getRegisterProcess();
      if (!resetFound && registerProcess) {
        let positionStart = this.getPositionFromI(registerProcess.startI);
        let positionEnd: PointCompatible = [positionStart[0], Infinity];
        let position: RangeCompatible = [positionStart, positionEnd];
        this.messages.push({
          location: {
            file: this.editorPath,
            position
          },
          severity: 'error',
          excerpt: `Reset '${signal.name}' missing`
        })
      }
    }
  }
  getPositionFromI(i: number): [number, number] {
    let row = 0;
    let col = 0;
    for(let count = 0; count < i; count++) {
      if (this.text[count] === '\n') {
        row++;
        col = 0;
      } else {
        col++;
      }
    }
    return [row, col];
  }
}

export function provideLinter() {
  return {
    name: 'Boss-Linter',
    scope: 'file', // or 'project'
    lintsOnChange: true, // or true
    grammarScopes: ['source.vhdl'],
    lint(textEditor: TextEditor) {
      const vhdlLinter = new VhdlLinter(textEditor.getPath() || '', textEditor.getText());
      const messages = vhdlLinter.checkAll();
      return messages;
    }
  }
}

export type Message = {
  // From providers
  location: {
    file: string,
    position: [[number, number], [number, number]],
  },
  reference?: {
    file: string,
    position?: Point,
  },
  url?: string,
  icon?: string,
  excerpt: string,
  severity: 'error' | 'warning' | 'info',
  solutions?: Array<{
    title?: string,
    position: Range,
    priority?: number,
    currentText?: string,
    replaceWith: string,
  } | {
    title?: string,
    priority?: number,
    position: Range,
    apply: (() => any),
  }>,
  description?: string | (() => Promise<string> | string)
  }
