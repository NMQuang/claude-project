       IDENTIFICATION DIVISION.
       PROGRAM-ID. DBUTIL.
      *****************************************************************
      * DATABASE UTILITY PROGRAM                                      *
      * Common database operations and maintenance tasks              *
      *****************************************************************

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-OPERATION            PIC X(20).
       01  WS-TABLE-NAME           PIC X(30).
       01  WS-RECORD-COUNT         PIC 9(10) VALUE 0.
       01  WS-SQLCODE              PIC S9(9) COMP.

           EXEC SQL
              INCLUDE SQLCA
           END-EXEC.

       01  WS-CUSTOMER-ID          PIC 9(10).
       01  WS-CUSTOMER-NAME        PIC X(50).
       01  WS-CUSTOMER-STATUS      PIC X(1).

       PROCEDURE DIVISION.
       MAIN-LOGIC.
           PERFORM GET-OPERATION
           EVALUATE WS-OPERATION
              WHEN 'BACKUP'
                 PERFORM BACKUP-TABLE
              WHEN 'RESTORE'
                 PERFORM RESTORE-TABLE
              WHEN 'VALIDATE'
                 PERFORM VALIDATE-DATA
              WHEN 'PURGE'
                 PERFORM PURGE-OLD-DATA
              WHEN 'REINDEX'
                 PERFORM REBUILD-INDEXES
              WHEN OTHER
                 DISPLAY 'Invalid operation'
           END-EVALUATE
           STOP RUN.

       GET-OPERATION.
           DISPLAY 'Database Utility Menu:'
           DISPLAY '1. BACKUP - Backup table'
           DISPLAY '2. RESTORE - Restore table'
           DISPLAY '3. VALIDATE - Validate data integrity'
           DISPLAY '4. PURGE - Purge old records'
           DISPLAY '5. REINDEX - Rebuild indexes'
           DISPLAY 'Enter operation: '
           ACCEPT WS-OPERATION.

       BACKUP-TABLE.
           DISPLAY 'Enter table name: '
           ACCEPT WS-TABLE-NAME

           EXEC SQL
              CREATE TABLE BACKUP_CUSTOMERS AS
              SELECT * FROM CUSTOMERS
           END-EXEC

           IF SQLCODE = 0
              DISPLAY 'Backup created successfully'
           ELSE
              DISPLAY 'Backup failed. SQLCODE: ' WS-SQLCODE
           END-IF.

       RESTORE-TABLE.
           DISPLAY 'Restoring from backup...'

           EXEC SQL
              DELETE FROM CUSTOMERS
           END-EXEC

           EXEC SQL
              INSERT INTO CUSTOMERS
              SELECT * FROM BACKUP_CUSTOMERS
           END-EXEC

           EXEC SQL
              COMMIT
           END-EXEC

           IF SQLCODE = 0
              DISPLAY 'Restore completed successfully'
           ELSE
              DISPLAY 'Restore failed. SQLCODE: ' WS-SQLCODE
              EXEC SQL
                 ROLLBACK
              END-EXEC
           END-IF.

       VALIDATE-DATA.
           DISPLAY 'Validating data integrity...'
           MOVE 0 TO WS-RECORD-COUNT

           EXEC SQL
              DECLARE CUST_CURSOR CURSOR FOR
              SELECT CUSTOMER_ID, CUSTOMER_NAME, STATUS
              FROM CUSTOMERS
           END-EXEC

           EXEC SQL
              OPEN CUST_CURSOR
           END-EXEC

           PERFORM VALIDATE-RECORD UNTIL SQLCODE NOT = 0.

           EXEC SQL
              CLOSE CUST_CURSOR
           END-EXEC

           DISPLAY 'Validation complete'
           DISPLAY 'Records validated: ' WS-RECORD-COUNT.

       VALIDATE-RECORD.
           EXEC SQL
              FETCH CUST_CURSOR
              INTO :WS-CUSTOMER-ID, :WS-CUSTOMER-NAME, :WS-CUSTOMER-STATUS
           END-EXEC

           IF SQLCODE = 0
              ADD 1 TO WS-RECORD-COUNT
              PERFORM CHECK-RECORD-VALIDITY
           END-IF.

       CHECK-RECORD-VALIDITY.
           IF WS-CUSTOMER-ID = 0
              DISPLAY 'Invalid customer ID: ' WS-CUSTOMER-ID
           END-IF

           IF WS-CUSTOMER-NAME = SPACES
              DISPLAY 'Empty customer name for ID: ' WS-CUSTOMER-ID
           END-IF

           IF WS-CUSTOMER-STATUS NOT = 'A' AND
              WS-CUSTOMER-STATUS NOT = 'I' AND
              WS-CUSTOMER-STATUS NOT = 'S'
              DISPLAY 'Invalid status for customer: ' WS-CUSTOMER-ID
           END-IF.

       PURGE-OLD-DATA.
           DISPLAY 'Purging old records...'

           EXEC SQL
              DELETE FROM TRANSACTIONS
              WHERE TRANSACTION_DATE < CURRENT_DATE - 365
           END-EXEC

           EXEC SQL
              COMMIT
           END-EXEC

           IF SQLCODE = 0
              DISPLAY 'Purge completed successfully'
           ELSE
              DISPLAY 'Purge failed. SQLCODE: ' WS-SQLCODE
           END-IF.

       REBUILD-INDEXES.
           DISPLAY 'Rebuilding indexes...'

           EXEC SQL
              ALTER INDEX IDX_CUSTOMER_NAME REBUILD
           END-EXEC

           EXEC SQL
              ALTER INDEX IDX_CUSTOMER_EMAIL REBUILD
           END-EXEC

           IF SQLCODE = 0
              DISPLAY 'Index rebuild completed'
           ELSE
              DISPLAY 'Index rebuild failed. SQLCODE: ' WS-SQLCODE
           END-IF.
