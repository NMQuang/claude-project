       IDENTIFICATION DIVISION.
       PROGRAM-ID. EMPCRUD.

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       EXEC SQL
           INCLUDE SQLCA
       END-EXEC.

       01 WS-EMPLOYEE.
           05 WS-EMP-ID      PIC X(5).
           05 WS-EMP-NAME    PIC X(50).
           05 WS-DEPT-CODE   PIC X(3).
           05 WS-SALARY      PIC 9(7)V99.

       01 WS-ACTION         PIC X(1).
          88 ACTION-CREATE  VALUE 'C'.
          88 ACTION-READ    VALUE 'R'.
          88 ACTION-UPDATE  VALUE 'U'.
          88 ACTION-DELETE  VALUE 'D'.

       PROCEDURE DIVISION.

       MAIN-PARA.
           DISPLAY "INPUT ACTION (C/R/U/D): "
           ACCEPT WS-ACTION

           EVALUATE TRUE
               WHEN ACTION-CREATE
                   PERFORM CREATE-EMP
               WHEN ACTION-READ
                   PERFORM READ-EMP
               WHEN ACTION-UPDATE
                   PERFORM UPDATE-EMP
               WHEN ACTION-DELETE
                   PERFORM DELETE-EMP
               WHEN OTHER
                   DISPLAY "INVALID ACTION"
           END-EVALUATE

           STOP RUN.

       CREATE-EMP.
           DISPLAY "EMP ID: " ACCEPT WS-EMP-ID
           DISPLAY "EMP NAME: " ACCEPT WS-EMP-NAME
           DISPLAY "DEPT CODE: " ACCEPT WS-DEPT-CODE
           DISPLAY "SALARY: " ACCEPT WS-SALARY

           EXEC SQL
               INSERT INTO EMPLOYEE
               (EMP_ID, EMP_NAME, DEPT_CODE, SALARY, CREATED_AT)
               VALUES
               (:WS-EMP-ID, :WS-EMP-NAME, :WS-DEPT-CODE,
                :WS-SALARY, CURRENT DATE)
           END-EXEC

           IF SQLCODE = 0
               DISPLAY "INSERT SUCCESS"
           ELSE
               DISPLAY "INSERT FAILED, SQLCODE=" SQLCODE
           END-IF.

       READ-EMP.
           DISPLAY "EMP ID: " ACCEPT WS-EMP-ID

           EXEC SQL
               SELECT EMP_NAME, DEPT_CODE, SALARY
               INTO :WS-EMP-NAME, :WS-DEPT-CODE, :WS-SALARY
               FROM EMPLOYEE
               WHERE EMP_ID = :WS-EMP-ID
           END-EXEC

           IF SQLCODE = 0
               DISPLAY "NAME : " WS-EMP-NAME
               DISPLAY "DEPT : " WS-DEPT-CODE
               DISPLAY "SALARY : " WS-SALARY
           ELSE
               DISPLAY "NOT FOUND"
           END-IF.

       UPDATE-EMP.
           DISPLAY "EMP ID: " ACCEPT WS-EMP-ID
           DISPLAY "NEW SALARY: " ACCEPT WS-SALARY

           EXEC SQL
               UPDATE EMPLOYEE
               SET SALARY = :WS-SALARY,
                   UPDATED_AT = CURRENT DATE
               WHERE EMP_ID = :WS-EMP-ID
           END-EXEC

           IF SQLCODE = 0
               DISPLAY "UPDATE SUCCESS"
           ELSE
               DISPLAY "UPDATE FAILED"
           END-IF.

       DELETE-EMP.
           DISPLAY "EMP ID: " ACCEPT WS-EMP-ID

           EXEC SQL
               DELETE FROM EMPLOYEE
               WHERE EMP_ID = :WS-EMP-ID
           END-EXEC

           IF SQLCODE = 0
               DISPLAY "DELETE SUCCESS"
           ELSE
               DISPLAY "DELETE FAILED"
           END-IF.
