       IDENTIFICATION DIVISION.
       PROGRAM-ID. CUSTMGMT.
       AUTHOR. MIGRATION-TEAM.
      *****************************************************************
      * CUSTOMER MANAGEMENT PROGRAM                                   *
      * This program handles customer CRUD operations                 *
      *****************************************************************

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CUSTOMER-FILE ASSIGN TO 'CUSTFILE'
           ORGANIZATION IS INDEXED
           ACCESS MODE IS DYNAMIC
           RECORD KEY IS CUST-ID
           FILE STATUS IS WS-FILE-STATUS.

       DATA DIVISION.
       FILE SECTION.
       FD  CUSTOMER-FILE.
       01  CUSTOMER-RECORD.
           05 CUST-ID              PIC 9(10).
           05 CUST-NAME            PIC X(50).
           05 CUST-EMAIL           PIC X(100).
           05 CUST-PHONE           PIC X(20).
           05 CUST-ADDRESS         PIC X(200).
           05 CUST-BALANCE         PIC 9(10)V99.
           05 CUST-STATUS          PIC X(1).
           05 CUST-CREATED-DATE    PIC X(10).

       WORKING-STORAGE SECTION.
       01  WS-FILE-STATUS          PIC XX.
       01  WS-OPERATION            PIC X(10).
       01  WS-CUSTOMER-COUNT       PIC 9(5) VALUE 0.
       01  WS-ERROR-FLAG           PIC X VALUE 'N'.

       PROCEDURE DIVISION.
       MAIN-LOGIC.
           PERFORM INITIALIZE-PROGRAM
           PERFORM PROCESS-CUSTOMERS
           PERFORM TERMINATE-PROGRAM
           STOP RUN.

       INITIALIZE-PROGRAM.
           DISPLAY 'Starting Customer Management Program'.
           OPEN I-O CUSTOMER-FILE
           IF WS-FILE-STATUS NOT = '00'
              DISPLAY 'Error opening customer file'
              MOVE 'Y' TO WS-ERROR-FLAG
           END-IF.

       PROCESS-CUSTOMERS.
           IF WS-ERROR-FLAG = 'N'
              PERFORM GET-OPERATION
              EVALUATE WS-OPERATION
                 WHEN 'CREATE'
                    PERFORM CREATE-CUSTOMER
                 WHEN 'READ'
                    PERFORM READ-CUSTOMER
                 WHEN 'UPDATE'
                    PERFORM UPDATE-CUSTOMER
                 WHEN 'DELETE'
                    PERFORM DELETE-CUSTOMER
                 WHEN OTHER
                    DISPLAY 'Invalid operation'
              END-EVALUATE
           END-IF.

       GET-OPERATION.
           DISPLAY 'Enter operation (CREATE/READ/UPDATE/DELETE): '
           ACCEPT WS-OPERATION.

       CREATE-CUSTOMER.
           DISPLAY 'Creating new customer...'
           PERFORM GET-CUSTOMER-DATA
           WRITE CUSTOMER-RECORD
           IF WS-FILE-STATUS = '00'
              DISPLAY 'Customer created successfully'
              ADD 1 TO WS-CUSTOMER-COUNT
           ELSE
              DISPLAY 'Error creating customer: ' WS-FILE-STATUS
           END-IF.

       READ-CUSTOMER.
           DISPLAY 'Enter Customer ID: '
           ACCEPT CUST-ID
           READ CUSTOMER-FILE
           INVALID KEY
              DISPLAY 'Customer not found'
           NOT INVALID KEY
              PERFORM DISPLAY-CUSTOMER
           END-READ.

       UPDATE-CUSTOMER.
           DISPLAY 'Enter Customer ID to update: '
           ACCEPT CUST-ID
           READ CUSTOMER-FILE
           INVALID KEY
              DISPLAY 'Customer not found'
           NOT INVALID KEY
              PERFORM GET-CUSTOMER-DATA
              REWRITE CUSTOMER-RECORD
              IF WS-FILE-STATUS = '00'
                 DISPLAY 'Customer updated successfully'
              ELSE
                 DISPLAY 'Error updating customer'
              END-IF
           END-READ.

       DELETE-CUSTOMER.
           DISPLAY 'Enter Customer ID to delete: '
           ACCEPT CUST-ID
           DELETE CUSTOMER-FILE
           INVALID KEY
              DISPLAY 'Customer not found'
           NOT INVALID KEY
              DISPLAY 'Customer deleted successfully'
           END-DELETE.

       GET-CUSTOMER-DATA.
           DISPLAY 'Enter Customer Name: '
           ACCEPT CUST-NAME
           DISPLAY 'Enter Email: '
           ACCEPT CUST-EMAIL
           DISPLAY 'Enter Phone: '
           ACCEPT CUST-PHONE
           DISPLAY 'Enter Address: '
           ACCEPT CUST-ADDRESS
           DISPLAY 'Enter Balance: '
           ACCEPT CUST-BALANCE
           MOVE 'A' TO CUST-STATUS
           ACCEPT CUST-CREATED-DATE FROM DATE.

       DISPLAY-CUSTOMER.
           DISPLAY 'Customer Details:'
           DISPLAY 'ID: ' CUST-ID
           DISPLAY 'Name: ' CUST-NAME
           DISPLAY 'Email: ' CUST-EMAIL
           DISPLAY 'Phone: ' CUST-PHONE
           DISPLAY 'Balance: ' CUST-BALANCE.

       TERMINATE-PROGRAM.
           CLOSE CUSTOMER-FILE
           DISPLAY 'Total customers processed: ' WS-CUSTOMER-COUNT
           DISPLAY 'Program terminated'.
