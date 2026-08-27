// Kalıcılık (DESIGN §7): SQLite checkpointer (v1). Faz-ortası provider çökmesi / process
// restart sonrası aynı thread_id ile resume edilebilir (dosyaya yazılır). Singleton: start ve
// resume istekleri aynı saver'ı paylaşır. DB dosyası gitignore'lu (*.sqlite). Framework-bağımsız.

import { join } from "node:path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

let saver: SqliteSaver | undefined;

export function getCheckpointer(): SqliteSaver {
  if (!saver) {
    const dbPath = process.env.DIVAN_CHECKPOINT_DB ?? join(process.cwd(), "divan-checkpoints.sqlite");
    saver = SqliteSaver.fromConnString(dbPath);
  }
  return saver;
}
