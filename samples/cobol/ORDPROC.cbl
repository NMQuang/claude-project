       IDENTIFICATION DIVISION.
       PROGRAM-ID. ORDPROC.
      *****************************************************************
      * ORDER PROCESSING PROGRAM                                      *
      *****************************************************************

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-ORDER-ID             PIC 9(10).
       01  WS-CUSTOMER-ID          PIC 9(10).
       01  WS-ORDER-TOTAL          PIC 9(10)V99.
       01  WS-TAX-RATE             PIC 9V99 VALUE 0.08.
       01  WS-TAX-AMOUNT           PIC 9(10)V99.
       01  WS-FINAL-TOTAL          PIC 9(10)V99.

       PROCEDURE DIVISION.
       MAIN-LOGIC.
           PERFORM PROCESS-ORDER
           STOP RUN.

       PROCESS-ORDER.
           DISPLAY 'Enter Order ID: '
           ACCEPT WS-ORDER-ID
           DISPLAY 'Enter Customer ID: '
           ACCEPT WS-CUSTOMER-ID
           PERFORM CALL CUSTMGMT
           PERFORM CALCULATE-ORDER-TOTAL
           PERFORM APPLY-TAX
           PERFORM DISPLAY-ORDER-SUMMARY.

       CALCULATE-ORDER-TOTAL.
           DISPLAY 'Enter Order Amount: '
           ACCEPT WS-ORDER-TOTAL.

       APPLY-TAX.
           COMPUTE WS-TAX-AMOUNT = WS-ORDER-TOTAL * WS-TAX-RATE
           COMPUTE WS-FINAL-TOTAL = WS-ORDER-TOTAL + WS-TAX-AMOUNT.

       DISPLAY-ORDER-SUMMARY.
           DISPLAY 'Order Summary:'
           DISPLAY 'Order ID: ' WS-ORDER-ID
           DISPLAY 'Customer ID: ' WS-CUSTOMER-ID
           DISPLAY 'Subtotal: ' WS-ORDER-TOTAL
           DISPLAY 'Tax: ' WS-TAX-AMOUNT
           DISPLAY 'Total: ' WS-FINAL-TOTAL.
