       IDENTIFICATION DIVISION.
       PROGRAM-ID. RPTGEN.
       AUTHOR. REPORTING-TEAM.
      *****************************************************************
      * MONTHLY SALES REPORT GENERATOR                                *
      * Generates comprehensive sales reports by region and product   *
      *****************************************************************

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT SALES-FILE ASSIGN TO 'SALESDAT'
           ORGANIZATION IS INDEXED
           ACCESS MODE IS SEQUENTIAL
           RECORD KEY IS SALE-ID
           FILE STATUS IS WS-SALES-STATUS.

           SELECT REPORT-FILE ASSIGN TO 'SALESRPT'
           ORGANIZATION IS LINE SEQUENTIAL
           FILE STATUS IS WS-REPORT-STATUS.

       DATA DIVISION.
       FILE SECTION.
       FD  SALES-FILE.
       01  SALES-RECORD.
           05 SALE-ID              PIC 9(12).
           05 SALE-DATE            PIC X(10).
           05 SALE-REGION          PIC X(20).
           05 SALE-PRODUCT         PIC X(30).
           05 SALE-QUANTITY        PIC 9(6).
           05 SALE-UNIT-PRICE      PIC 9(8)V99.
           05 SALE-TOTAL           PIC 9(10)V99.
           05 SALE-SALESPERSON     PIC X(50).

       FD  REPORT-FILE.
       01  REPORT-LINE             PIC X(132).

       WORKING-STORAGE SECTION.
       01  WS-SALES-STATUS         PIC XX.
       01  WS-REPORT-STATUS        PIC XX.
       01  WS-EOF-FLAG             PIC X VALUE 'N'.
       01  WS-PAGE-NUMBER          PIC 999 VALUE 1.
       01  WS-LINE-COUNT           PIC 99 VALUE 0.
       01  WS-LINES-PER-PAGE       PIC 99 VALUE 50.

       01  WS-CURRENT-REGION       PIC X(20).
       01  WS-REGION-TOTAL         PIC 9(12)V99 VALUE 0.
       01  WS-GRAND-TOTAL          PIC 9(12)V99 VALUE 0.
       01  WS-RECORD-COUNT         PIC 9(8) VALUE 0.

       01  REPORT-HEADER.
           05 FILLER               PIC X(50) VALUE
              '                    MONTHLY SALES REPORT'.
           05 FILLER               PIC X(20) VALUE '     PAGE: '.
           05 RH-PAGE              PIC ZZ9.
           05 FILLER               PIC X(59) VALUE SPACES.

       01  COLUMN-HEADER-1.
           05 FILLER               PIC X(132) VALUE
              'SALE ID      DATE       REGION            PRODUCT'.

       01  COLUMN-HEADER-2.
           05 FILLER               PIC X(132) VALUE
              '         QUANTITY    UNIT PRICE    TOTAL      SALESPERSON'.

       01  DETAIL-LINE.
           05 DL-SALE-ID           PIC 9(12).
           05 FILLER               PIC X(2) VALUE SPACES.
           05 DL-DATE              PIC X(10).
           05 FILLER               PIC X(2) VALUE SPACES.
           05 DL-REGION            PIC X(20).
           05 FILLER               PIC X(2) VALUE SPACES.
           05 DL-PRODUCT           PIC X(30).
           05 FILLER               PIC X(54) VALUE SPACES.

       01  DETAIL-LINE-2.
           05 FILLER               PIC X(10) VALUE SPACES.
           05 DL-QUANTITY          PIC ZZZ,ZZ9.
           05 FILLER               PIC X(4) VALUE SPACES.
           05 DL-UNIT-PRICE        PIC $$$,$$9.99.
           05 FILLER               PIC X(2) VALUE SPACES.
           05 DL-TOTAL             PIC $$$,$$$,$$9.99.
           05 FILLER               PIC X(2) VALUE SPACES.
           05 DL-SALESPERSON       PIC X(50).

       01  REGION-TOTAL-LINE.
           05 FILLER               PIC X(40) VALUE
              '               REGION TOTAL: '.
           05 RTL-TOTAL            PIC $$$,$$$,$$9.99.
           05 FILLER               PIC X(78) VALUE SPACES.

       01  GRAND-TOTAL-LINE.
           05 FILLER               PIC X(40) VALUE
              '               GRAND TOTAL:  '.
           05 GTL-TOTAL            PIC $$$,$$$,$$9.99.
           05 FILLER               PIC X(78) VALUE SPACES.

       PROCEDURE DIVISION.
       MAIN-LOGIC.
           PERFORM INITIALIZE-REPORT
           PERFORM PROCESS-SALES-DATA UNTIL WS-EOF-FLAG = 'Y'
           PERFORM FINALIZE-REPORT
           STOP RUN.

       INITIALIZE-REPORT.
           OPEN INPUT SALES-FILE
           OPEN OUTPUT REPORT-FILE
           IF WS-SALES-STATUS NOT = '00' OR WS-REPORT-STATUS NOT = '00'
              DISPLAY 'Error opening files'
              STOP RUN
           END-IF
           PERFORM PRINT-HEADER
           MOVE SPACES TO WS-CURRENT-REGION.

       PROCESS-SALES-DATA.
           READ SALES-FILE
              AT END
                 MOVE 'Y' TO WS-EOF-FLAG
                 IF WS-CURRENT-REGION NOT = SPACES
                    PERFORM PRINT-REGION-TOTAL
                 END-IF
              NOT AT END
                 PERFORM CHECK-REGION-BREAK
                 PERFORM PRINT-DETAIL-LINE
                 ADD SALE-TOTAL TO WS-REGION-TOTAL
                 ADD SALE-TOTAL TO WS-GRAND-TOTAL
                 ADD 1 TO WS-RECORD-COUNT
           END-READ.

       CHECK-REGION-BREAK.
           IF WS-CURRENT-REGION = SPACES
              MOVE SALE-REGION TO WS-CURRENT-REGION
           ELSE
              IF SALE-REGION NOT = WS-CURRENT-REGION
                 PERFORM PRINT-REGION-TOTAL
                 MOVE 0 TO WS-REGION-TOTAL
                 MOVE SALE-REGION TO WS-CURRENT-REGION
                 PERFORM CHECK-PAGE-BREAK
              END-IF
           END-IF.

       PRINT-HEADER.
           MOVE WS-PAGE-NUMBER TO RH-PAGE
           WRITE REPORT-LINE FROM REPORT-HEADER AFTER ADVANCING PAGE
           WRITE REPORT-LINE FROM COLUMN-HEADER-1
              AFTER ADVANCING 2 LINES
           WRITE REPORT-LINE FROM COLUMN-HEADER-2
              AFTER ADVANCING 1 LINE
           MOVE 4 TO WS-LINE-COUNT.

       PRINT-DETAIL-LINE.
           PERFORM CHECK-PAGE-BREAK

           MOVE SALE-ID TO DL-SALE-ID
           MOVE SALE-DATE TO DL-DATE
           MOVE SALE-REGION TO DL-REGION
           MOVE SALE-PRODUCT TO DL-PRODUCT
           WRITE REPORT-LINE FROM DETAIL-LINE AFTER ADVANCING 1 LINE

           MOVE SALE-QUANTITY TO DL-QUANTITY
           MOVE SALE-UNIT-PRICE TO DL-UNIT-PRICE
           MOVE SALE-TOTAL TO DL-TOTAL
           MOVE SALE-SALESPERSON TO DL-SALESPERSON
           WRITE REPORT-LINE FROM DETAIL-LINE-2 AFTER ADVANCING 1 LINE

           ADD 3 TO WS-LINE-COUNT.

       PRINT-REGION-TOTAL.
           MOVE WS-REGION-TOTAL TO RTL-TOTAL
           WRITE REPORT-LINE FROM REGION-TOTAL-LINE
              AFTER ADVANCING 2 LINES
           ADD 2 TO WS-LINE-COUNT.

       CHECK-PAGE-BREAK.
           IF WS-LINE-COUNT > WS-LINES-PER-PAGE
              ADD 1 TO WS-PAGE-NUMBER
              PERFORM PRINT-HEADER
           END-IF.

       FINALIZE-REPORT.
           MOVE WS-GRAND-TOTAL TO GTL-TOTAL
           WRITE REPORT-LINE FROM GRAND-TOTAL-LINE
              AFTER ADVANCING 3 LINES

           DISPLAY 'Report Generation Complete'
           DISPLAY 'Total Records: ' WS-RECORD-COUNT
           DISPLAY 'Grand Total: ' WS-GRAND-TOTAL

           CLOSE SALES-FILE
           CLOSE REPORT-FILE.
