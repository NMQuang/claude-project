       IDENTIFICATION DIVISION.
       PROGRAM-ID. BATCHJOB.
       AUTHOR. LEGACY-TEAM.
      *****************************************************************
      * DAILY BATCH JOB - CUSTOMER ACCOUNT PROCESSING                 *
      * Process daily transactions and update customer balances       *
      *****************************************************************

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRANSACTION-FILE ASSIGN TO 'TRANFILE'
           ORGANIZATION IS SEQUENTIAL
           ACCESS MODE IS SEQUENTIAL
           FILE STATUS IS WS-TRAN-STATUS.

           SELECT CUSTOMER-FILE ASSIGN TO 'CUSTFILE'
           ORGANIZATION IS INDEXED
           ACCESS MODE IS DYNAMIC
           RECORD KEY IS CUST-ID
           FILE STATUS IS WS-CUST-STATUS.

           SELECT ERROR-LOG ASSIGN TO 'ERRLOG'
           ORGANIZATION IS SEQUENTIAL
           FILE STATUS IS WS-LOG-STATUS.

       DATA DIVISION.
       FILE SECTION.
       FD  TRANSACTION-FILE.
       01  TRANSACTION-RECORD.
           05 TRAN-ID              PIC 9(15).
           05 TRAN-CUST-ID         PIC 9(10).
           05 TRAN-TYPE            PIC X(2).
           05 TRAN-AMOUNT          PIC 9(10)V99.
           05 TRAN-DATE            PIC X(10).
           05 TRAN-TIME            PIC X(8).

       FD  CUSTOMER-FILE.
       01  CUSTOMER-RECORD.
           05 CUST-ID              PIC 9(10).
           05 CUST-NAME            PIC X(50).
           05 CUST-BALANCE         PIC S9(10)V99.
           05 CUST-CREDIT-LIMIT    PIC 9(10)V99.
           05 CUST-STATUS          PIC X(1).

       FD  ERROR-LOG.
       01  ERROR-RECORD.
           05 ERR-TIMESTAMP        PIC X(20).
           05 ERR-TRAN-ID          PIC 9(15).
           05 ERR-MESSAGE          PIC X(100).

       WORKING-STORAGE SECTION.
       01  WS-TRAN-STATUS          PIC XX.
       01  WS-CUST-STATUS          PIC XX.
       01  WS-LOG-STATUS           PIC XX.
       01  WS-EOF-FLAG             PIC X VALUE 'N'.
       01  WS-TRANSACTION-COUNT    PIC 9(7) VALUE 0.
       01  WS-SUCCESS-COUNT        PIC 9(7) VALUE 0.
       01  WS-ERROR-COUNT          PIC 9(7) VALUE 0.
       01  WS-TOTAL-AMOUNT         PIC S9(12)V99 VALUE 0.
       01  WS-NEW-BALANCE          PIC S9(10)V99.
       01  WS-TIMESTAMP            PIC X(20).

       PROCEDURE DIVISION.
       MAIN-PROCESS.
           PERFORM INITIALIZATION
           PERFORM PROCESS-TRANSACTIONS UNTIL WS-EOF-FLAG = 'Y'
           PERFORM FINALIZATION
           STOP RUN.

       INITIALIZATION.
           DISPLAY 'Starting Daily Batch Job'
           ACCEPT WS-TIMESTAMP FROM DATE-TIME
           OPEN INPUT TRANSACTION-FILE
           OPEN I-O CUSTOMER-FILE
           OPEN OUTPUT ERROR-LOG
           IF WS-TRAN-STATUS NOT = '00' OR
              WS-CUST-STATUS NOT = '00' OR
              WS-LOG-STATUS NOT = '00'
              DISPLAY 'Error opening files'
              PERFORM EMERGENCY-SHUTDOWN
           END-IF.

       PROCESS-TRANSACTIONS.
           READ TRANSACTION-FILE
              AT END
                 MOVE 'Y' TO WS-EOF-FLAG
              NOT AT END
                 PERFORM PROCESS-SINGLE-TRANSACTION
           END-READ.

       PROCESS-SINGLE-TRANSACTION.
           ADD 1 TO WS-TRANSACTION-COUNT

           EVALUATE TRAN-TYPE
              WHEN 'CR'
                 PERFORM PROCESS-CREDIT
              WHEN 'DB'
                 PERFORM PROCESS-DEBIT
              WHEN 'AD'
                 PERFORM PROCESS-ADJUSTMENT
              WHEN OTHER
                 PERFORM LOG-INVALID-TRANSACTION
           END-EVALUATE.

       PROCESS-CREDIT.
           MOVE TRAN-CUST-ID TO CUST-ID
           READ CUSTOMER-FILE
              INVALID KEY
                 PERFORM LOG-CUSTOMER-NOT-FOUND
              NOT INVALID KEY
                 ADD TRAN-AMOUNT TO CUST-BALANCE
                 REWRITE CUSTOMER-RECORD
                 IF WS-CUST-STATUS = '00'
                    ADD 1 TO WS-SUCCESS-COUNT
                    ADD TRAN-AMOUNT TO WS-TOTAL-AMOUNT
                 ELSE
                    PERFORM LOG-UPDATE-ERROR
                 END-IF
           END-READ.

       PROCESS-DEBIT.
           MOVE TRAN-CUST-ID TO CUST-ID
           READ CUSTOMER-FILE
              INVALID KEY
                 PERFORM LOG-CUSTOMER-NOT-FOUND
              NOT INVALID KEY
                 COMPUTE WS-NEW-BALANCE = CUST-BALANCE - TRAN-AMOUNT
                 IF WS-NEW-BALANCE < (CUST-CREDIT-LIMIT * -1)
                    PERFORM LOG-CREDIT-LIMIT-EXCEEDED
                 ELSE
                    MOVE WS-NEW-BALANCE TO CUST-BALANCE
                    REWRITE CUSTOMER-RECORD
                    IF WS-CUST-STATUS = '00'
                       ADD 1 TO WS-SUCCESS-COUNT
                       SUBTRACT TRAN-AMOUNT FROM WS-TOTAL-AMOUNT
                    ELSE
                       PERFORM LOG-UPDATE-ERROR
                    END-IF
                 END-IF
           END-READ.

       PROCESS-ADJUSTMENT.
           MOVE TRAN-CUST-ID TO CUST-ID
           READ CUSTOMER-FILE
              INVALID KEY
                 PERFORM LOG-CUSTOMER-NOT-FOUND
              NOT INVALID KEY
                 IF TRAN-AMOUNT > 0
                    ADD TRAN-AMOUNT TO CUST-BALANCE
                 ELSE
                    SUBTRACT TRAN-AMOUNT FROM CUST-BALANCE
                 END-IF
                 REWRITE CUSTOMER-RECORD
                 IF WS-CUST-STATUS = '00'
                    ADD 1 TO WS-SUCCESS-COUNT
                 ELSE
                    PERFORM LOG-UPDATE-ERROR
                 END-IF
           END-READ.

       LOG-INVALID-TRANSACTION.
           MOVE WS-TIMESTAMP TO ERR-TIMESTAMP
           MOVE TRAN-ID TO ERR-TRAN-ID
           MOVE 'Invalid transaction type' TO ERR-MESSAGE
           WRITE ERROR-RECORD
           ADD 1 TO WS-ERROR-COUNT.

       LOG-CUSTOMER-NOT-FOUND.
           MOVE WS-TIMESTAMP TO ERR-TIMESTAMP
           MOVE TRAN-ID TO ERR-TRAN-ID
           MOVE 'Customer not found' TO ERR-MESSAGE
           WRITE ERROR-RECORD
           ADD 1 TO WS-ERROR-COUNT.

       LOG-CREDIT-LIMIT-EXCEEDED.
           MOVE WS-TIMESTAMP TO ERR-TIMESTAMP
           MOVE TRAN-ID TO ERR-TRAN-ID
           MOVE 'Credit limit exceeded' TO ERR-MESSAGE
           WRITE ERROR-RECORD
           ADD 1 TO WS-ERROR-COUNT.

       LOG-UPDATE-ERROR.
           MOVE WS-TIMESTAMP TO ERR-TIMESTAMP
           MOVE TRAN-ID TO ERR-TRAN-ID
           MOVE 'Error updating customer record' TO ERR-MESSAGE
           WRITE ERROR-RECORD
           ADD 1 TO WS-ERROR-COUNT.

       FINALIZATION.
           CLOSE TRANSACTION-FILE
           CLOSE CUSTOMER-FILE
           CLOSE ERROR-LOG

           DISPLAY 'Batch Job Complete'
           DISPLAY 'Total Transactions: ' WS-TRANSACTION-COUNT
           DISPLAY 'Successful: ' WS-SUCCESS-COUNT
           DISPLAY 'Errors: ' WS-ERROR-COUNT
           DISPLAY 'Net Amount: ' WS-TOTAL-AMOUNT.

       EMERGENCY-SHUTDOWN.
           DISPLAY 'Emergency shutdown initiated'
           STOP RUN.
