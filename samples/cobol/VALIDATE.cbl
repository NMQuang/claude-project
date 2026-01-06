       IDENTIFICATION DIVISION.
       PROGRAM-ID. VALIDATE.
      *****************************************************************
      * DATA VALIDATION AND CALCULATION MODULE                        *
      * Validates business rules and performs complex calculations    *
      *****************************************************************

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-CUSTOMER-ID          PIC 9(10).
       01  WS-ORDER-AMOUNT         PIC 9(10)V99.
       01  WS-DISCOUNT-PCT         PIC 9V99.
       01  WS-DISCOUNT-AMOUNT      PIC 9(10)V99.
       01  WS-TAX-RATE             PIC 9V9999.
       01  WS-TAX-AMOUNT           PIC 9(10)V99.
       01  WS-SHIPPING-COST        PIC 9(8)V99.
       01  WS-FINAL-TOTAL          PIC 9(10)V99.
       01  WS-VALIDATION-STATUS    PIC X VALUE 'N'.
       01  WS-ERROR-MESSAGE        PIC X(100).

       01  CUSTOMER-DATA.
           05 CUST-TYPE            PIC X(1).
           05 CUST-CREDIT-RATING   PIC X(1).
           05 CUST-BALANCE         PIC S9(10)V99.
           05 CUST-CREDIT-LIMIT    PIC 9(10)V99.
           05 CUST-YTD-PURCHASES   PIC 9(12)V99.

       01  VALIDATION-RULES.
           05 MIN-ORDER-AMOUNT     PIC 9(8)V99 VALUE 10.00.
           05 MAX-ORDER-AMOUNT     PIC 9(10)V99 VALUE 999999.99.
           05 MIN-CREDIT-RATING    PIC X VALUE 'D'.

       PROCEDURE DIVISION.
       MAIN-LOGIC.
           PERFORM GET-ORDER-DATA
           PERFORM VALIDATE-CUSTOMER
           IF WS-VALIDATION-STATUS = 'Y'
              PERFORM CALCULATE-ORDER-TOTAL
              PERFORM DISPLAY-ORDER-SUMMARY
           ELSE
              DISPLAY 'Validation failed: ' WS-ERROR-MESSAGE
           END-IF
           STOP RUN.

       GET-ORDER-DATA.
           DISPLAY 'Enter Customer ID: '
           ACCEPT WS-CUSTOMER-ID
           DISPLAY 'Enter Order Amount: '
           ACCEPT WS-ORDER-AMOUNT

           PERFORM CALL 'CUSTMGMT'

           MOVE 'P' TO CUST-TYPE
           MOVE 'B' TO CUST-CREDIT-RATING
           MOVE 5000.00 TO CUST-BALANCE
           MOVE 10000.00 TO CUST-CREDIT-LIMIT
           MOVE 25000.00 TO CUST-YTD-PURCHASES.

       VALIDATE-CUSTOMER.
           MOVE 'N' TO WS-VALIDATION-STATUS

           IF WS-ORDER-AMOUNT < MIN-ORDER-AMOUNT
              MOVE 'Order amount below minimum' TO WS-ERROR-MESSAGE
           ELSE IF WS-ORDER-AMOUNT > MAX-ORDER-AMOUNT
              MOVE 'Order amount exceeds maximum' TO WS-ERROR-MESSAGE
           ELSE IF CUST-CREDIT-RATING < MIN-CREDIT-RATING
              MOVE 'Credit rating too low' TO WS-ERROR-MESSAGE
           ELSE
              PERFORM CHECK-CREDIT-LIMIT
           END-IF.

       CHECK-CREDIT-LIMIT.
           COMPUTE WS-FINAL-TOTAL = CUST-BALANCE + WS-ORDER-AMOUNT

           IF WS-FINAL-TOTAL > CUST-CREDIT-LIMIT
              MOVE 'Credit limit would be exceeded' TO WS-ERROR-MESSAGE
           ELSE
              MOVE 'Y' TO WS-VALIDATION-STATUS
           END-IF.

       CALCULATE-ORDER-TOTAL.
           PERFORM CALCULATE-DISCOUNT
           PERFORM CALCULATE-TAX
           PERFORM CALCULATE-SHIPPING

           COMPUTE WS-FINAL-TOTAL ROUNDED =
              WS-ORDER-AMOUNT
              - WS-DISCOUNT-AMOUNT
              + WS-TAX-AMOUNT
              + WS-SHIPPING-COST.

       CALCULATE-DISCOUNT.
           EVALUATE CUST-TYPE
              WHEN 'P'
                 IF CUST-YTD-PURCHASES > 100000
                    MOVE 0.15 TO WS-DISCOUNT-PCT
                 ELSE IF CUST-YTD-PURCHASES > 50000
                    MOVE 0.10 TO WS-DISCOUNT-PCT
                 ELSE
                    MOVE 0.05 TO WS-DISCOUNT-PCT
                 END-IF
              WHEN 'R'
                 MOVE 0.02 TO WS-DISCOUNT-PCT
              WHEN OTHER
                 MOVE 0 TO WS-DISCOUNT-PCT
           END-EVALUATE

           COMPUTE WS-DISCOUNT-AMOUNT ROUNDED =
              WS-ORDER-AMOUNT * WS-DISCOUNT-PCT.

       CALCULATE-TAX.
           EVALUATE CUST-TYPE
              WHEN 'P'
                 MOVE 0.08 TO WS-TAX-RATE
              WHEN 'R'
                 MOVE 0.10 TO WS-TAX-RATE
              WHEN OTHER
                 MOVE 0.08 TO WS-TAX-RATE
           END-EVALUATE

           COMPUTE WS-TAX-AMOUNT ROUNDED =
              (WS-ORDER-AMOUNT - WS-DISCOUNT-AMOUNT) * WS-TAX-RATE.

       CALCULATE-SHIPPING.
           IF WS-ORDER-AMOUNT > 500
              MOVE 0 TO WS-SHIPPING-COST
           ELSE IF WS-ORDER-AMOUNT > 100
              MOVE 10.00 TO WS-SHIPPING-COST
           ELSE
              MOVE 15.00 TO WS-SHIPPING-COST
           END-IF.

       DISPLAY-ORDER-SUMMARY.
           DISPLAY '=========================================='
           DISPLAY 'ORDER SUMMARY'
           DISPLAY '=========================================='
           DISPLAY 'Customer ID: ' WS-CUSTOMER-ID
           DISPLAY 'Order Amount: $' WS-ORDER-AMOUNT
           DISPLAY 'Discount (' WS-DISCOUNT-PCT '%): $'
              WS-DISCOUNT-AMOUNT
           DISPLAY 'Tax: $' WS-TAX-AMOUNT
           DISPLAY 'Shipping: $' WS-SHIPPING-COST
           DISPLAY '=========================================='
           DISPLAY 'TOTAL: $' WS-FINAL-TOTAL
           DISPLAY '========================================='.
