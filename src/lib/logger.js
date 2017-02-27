import chalk from 'chalk';
import blessed from 'blessed';

let tracerOptions = {
    methods: ['log', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    filters: {
        trace: chalk.grey,
        debug: [chalk.white, chalk.dim],
        warn: chalk.yellow,
        error: [chalk.red],
        fatal: [chalk.white, chalk.bgRed, chalk.bold]
    },
    preprocess: function(data) {
        data.title = data.title.toUpperCase();
        for (let k in Object.keys(data.args)) {
            if (typeof data.args[k] === 'string')
                data.args[k] = data.args[k].replace(/\n/g, "\n\t");
        }
    }
};

if (process.stdout.isTTY && ~~process.argv.indexOf('--not-blessed')) {
    const screen = blessed.screen({
        smartCSR: true
    });

    const log = blessed.log({
        parent: screen,
        top: '0',
        left: '0',
        width: '100%',
        height: '50%',
        border: {
            type: 'line'
        },
    });

    tracerOptions.transport = (data) => {
        log.log(data.output);

        // Render the screen.
        screen.render();
    }

    // Focus our element.
    log.focus();


    // Render the screen.
    screen.render();
}

const tracer = require('tracer').colorConsole(tracerOptions);
export default tracer;
