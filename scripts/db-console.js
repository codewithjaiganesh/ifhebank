
const readline = require("readline");
const pool = require("../src/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\nBranchFlow MySQL Console");
console.log("Type SQL commands. Type exit to close.\n");

function askQuery() {
  rl.question("branchflow-sql> ", async (input) => {
    const sql = input.trim();

    if (!sql) return askQuery();

    if (sql.toLowerCase() === "exit") {
      await pool.end();
      rl.close();
      return;
    }

    try {
      const [rows] = await pool.query(sql);

      if (Array.isArray(rows)) {
        console.table(rows);
        console.log(`${rows.length} row(s) returned.\n`);
      } else {
        console.log("Query successful:", rows, "\n");
      }
    } catch (error) {
      console.log("SQL Error:", error.message, "\n");
    }

    askQuery();
  });
}

askQuery();
