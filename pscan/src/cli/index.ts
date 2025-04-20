import { program } from 'commander';

program
    .name(('my-cli'))
    .description('The default CLI for my project')
    .version('1.0.0')
    .action(() => {
        console.log(`hello world`);
    });

program.parse(); 