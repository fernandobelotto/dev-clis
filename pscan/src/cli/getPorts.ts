import { execa } from 'execa';
import { PortInfo } from './interfaces';

export async function getPorts(): Promise<PortInfo[]> {
    // Use lsof to get ports in use (macOS/Linux)
    try {
      const { stdout } = await execa('lsof', ['-iTCP', '-sTCP:LISTEN', '-Pn']);
      const lines = stdout.split('\n').slice(1); // skip header
  
      const ports: PortInfo[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
  
        try {
          // Basic split, but be mindful command names could have spaces (lsof often truncates)
          const parts = line.trim().split(/\s+/);
          if (parts.length < 9) { // Need at least ~9 fields typically ending in NAME (state)
             // console.warn(`Skipping short lsof line: "${line}"`); // Optional: uncomment for debugging
             continue;
          }
  
          const command = parts[0];
          const pid = parts[1];
          const user = parts[2];
  
          // Ensure '(LISTEN)' is present (though -sTCP:LISTEN should guarantee it)
          // This helps anchor our search for the network address
          const listenIndex = line.lastIndexOf('(LISTEN)');
          if (listenIndex === -1) {
              // console.warn(`Skipping line without (LISTEN): "${line}"`); // Optional: uncomment for debugging
              continue;
          }
  
          // Extract the network address part (e.g., "[::1]:5173", "*:8080")
          // It's typically the field right before '(LISTEN)'
          const addressEndIndex = listenIndex - 1; // Index right before '('
          // Find the start of the address by looking for the space before it
          const addressStartIndex = line.lastIndexOf(' ', addressEndIndex -1) + 1;
          if (addressStartIndex === 0) { // Checking result of lastIndexOf(' ') + 1
               // console.warn(`Could not find start of network address: "${line}"`); // Optional: uncomment for debugging
               continue; // Could not determine address start
          }
  
          const networkAddress = line.substring(addressStartIndex, addressEndIndex).trim();
  
          // Extract port from the *end* of the network address
          const portMatch = networkAddress.match(/:(\d+)$/); // Match ':port' at the very end
          if (!portMatch) {
               // console.warn(`Could not extract port from address "${networkAddress}" in line: "${line}"`); // Optional: uncomment for debugging
               continue; // Didn't find ':port' at the end
          }
          const port = portMatch[1];
  
          // Use the cleaner networkAddress for the name property
          ports.push({ command, pid, user, port, name: networkAddress });
  
        } catch (e) {
          // Log specific parsing errors for a line
          console.error(`Failed to parse lsof line: "${line}"`, e);
        }
      }
  
      // Remove duplicates by port (keeps the first entry found for each port)
      const seen = new Set<string>();
      return ports.filter((p: PortInfo) => {
        if (seen.has(p.port)) {
          // console.log(`Filtering duplicate port ${p.port} from PID ${p.pid} (${p.name})`); // Optional: Debug duplicate filtering
          return false;
        }
        seen.add(p.port);
        return true;
      });
    } catch (err) {
      // Log errors during lsof execution or top-level processing
      console.error('Failed to execute or process lsof:', err);
      return [];
    }
  }