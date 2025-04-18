import { LineCounterTable } from './lib/LineCounterTable';
import { internalDefinitions } from './lib/internalDefinitions';
import Gitignore from './lib/Gitignore';
import { Count } from './lib/LineCounter';
import { LanguageConf } from './lib/LineCounterTable';

async function test() {
    // Test LineCounterTable
    console.log('Testing LineCounterTable...');
    const definitions = new Map(
        Object.entries(internalDefinitions).map(([key, value]) => [
            key,
            {
                aliases: value.aliases ?? [],
                filenames: value.filenames ?? [],
                extensions: value.extensions ?? [],
                lineComments: value.lineComments ?? [],
                blockComments: value.blockComments ?? [],
                blockStrings: value.blockStrings ?? [],
                lineStrings: value.lineStrings ?? [],
            } as LanguageConf
        ])
    );
    const counterTable = new LineCounterTable(definitions, []);
    
    const testFiles = [
        'test.js',
        'test.ts',
        'test.py',
        'test.java',
        'test.go',
        'test.rs',
        'test.rb',
        'test.php',
        'test.html',
        'test.css',
        'test.json',
        'test.yaml',
        'test.md',
        'test.sh',
        'test.bat'
    ];

    for (const file of testFiles) {
        const counter = counterTable.getCounter(file);
        console.log(`${file}: ${counter ? counter.name : 'Unsupported'}`);
    }

    // Test Gitignore
    console.log('\nTesting Gitignore...');
    const gitignore = new Gitignore(`
        node_modules/
        dist/
        *.log
        !important.log
    `);

    const testPaths = [
        'node_modules/package.json',
        'src/index.ts',
        'dist/index.js',
        'error.log',
        'important.log'
    ];

    for (const path of testPaths) {
        console.log(`${path}: ${gitignore.excludes(path) ? 'Excluded' : 'Included'}`);
    }

    // Test Count
    console.log('\nTesting Count...');
    const count1 = new Count();
    count1.add({ code: 10, comment: 5, blank: 2 });
    console.log('Count after adding:', count1);
    
    const count2 = new Count();
    count2.add({ code: 3, comment: 1, blank: 0 });
    count1.sub(count2);
    console.log('Count after subtracting:', count1);
    console.log('Total:', count1.total);
    console.log('Is empty:', count1.isEmpty);
}

test().catch(console.error); 