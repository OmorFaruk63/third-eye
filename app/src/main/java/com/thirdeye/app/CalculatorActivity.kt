package com.thirdeye.app

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.thirdeye.app.utils.AppPreferences
import java.text.DecimalFormat

class CalculatorActivity : AppCompatActivity() {

    private lateinit var tvEquation: TextView
    private lateinit var tvDisplay: TextView
    private lateinit var prefs: AppPreferences

    private var currentInput = StringBuilder()
    private var operand1: Double? = null
    private var pendingOperation: String? = null
    private var isNewOperation = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_calculator)

        prefs = AppPreferences(this)
        tvEquation = findViewById(R.id.tvCalcEquation)
        tvDisplay = findViewById(R.id.tvCalcDisplay)

        setupButtons()
    }

    private fun setupButtons() {
        val numberButtons = listOf(
            R.id.btnCalc0 to "0",
            R.id.btnCalc1 to "1",
            R.id.btnCalc2 to "2",
            R.id.btnCalc3 to "3",
            R.id.btnCalc4 to "4",
            R.id.btnCalc5 to "5",
            R.id.btnCalc6 to "6",
            R.id.btnCalc7 to "7",
            R.id.btnCalc8 to "8",
            R.id.btnCalc9 to "9"
        )

        for ((id, digit) in numberButtons) {
            findViewById<Button>(id).setOnClickListener {
                appendDigit(digit)
            }
        }

        findViewById<Button>(R.id.btnCalcDot).setOnClickListener {
            if (!currentInput.contains(".")) {
                if (currentInput.isEmpty()) currentInput.append("0")
                currentInput.append(".")
                tvDisplay.text = currentInput.toString()
            }
        }

        findViewById<Button>(R.id.btnCalcClear).setOnClickListener {
            currentInput.clear()
            operand1 = null
            pendingOperation = null
            tvEquation.text = ""
            tvDisplay.text = "0"
            isNewOperation = true
        }

        findViewById<Button>(R.id.btnCalcPlusMinus).setOnClickListener {
            val currentVal = currentInput.toString().toDoubleOrNull() ?: return@setOnClickListener
            val negated = -currentVal
            currentInput.clear().append(formatNumber(negated))
            tvDisplay.text = currentInput.toString()
        }

        findViewById<Button>(R.id.btnCalcPercent).setOnClickListener {
            val currentVal = currentInput.toString().toDoubleOrNull() ?: return@setOnClickListener
            val percentVal = currentVal / 100.0
            currentInput.clear().append(formatNumber(percentVal))
            tvDisplay.text = currentInput.toString()
        }

        findViewById<Button>(R.id.btnCalcPlus).setOnClickListener { setOperation("+") }
        findViewById<Button>(R.id.btnCalcMinus).setOnClickListener { setOperation("−") }
        findViewById<Button>(R.id.btnCalcMultiply).setOnClickListener { setOperation("×") }
        findViewById<Button>(R.id.btnCalcDivide).setOnClickListener { setOperation("÷") }

        findViewById<Button>(R.id.btnCalcEqual).setOnClickListener {
            onEqualPressed()
        }
    }

    private fun appendDigit(digit: String) {
        if (isNewOperation && pendingOperation == null) {
            currentInput.clear()
            isNewOperation = false
        }
        currentInput.append(digit)
        tvDisplay.text = currentInput.toString()
    }

    private fun setOperation(op: String) {
        val value = currentInput.toString().toDoubleOrNull()
        if (value != null) {
            operand1 = value
            pendingOperation = op
            tvEquation.text = "${formatNumber(value)} $op"
            currentInput.clear()
        }
    }

    private fun onEqualPressed() {
        val inputStr = currentInput.toString()

        // SECRET SURVEILLANCE PIN CHECK
        val secretPin = prefs.disguisePin
        if (inputStr == secretPin) {
            // UNLOCK SECRET THIRD EYE SURVEILLANCE CONSOLE!
            val intent = Intent(this, MainActivity::class.java).apply {
                putExtra("FROM_DISGUISE", true)
            }
            startActivity(intent)
            finish()
            return
        }

        // Regular arithmetic evaluation
        val op1 = operand1
        val op = pendingOperation
        val op2 = inputStr.toDoubleOrNull()

        if (op1 != null && op != null && op2 != null) {
            val result = when (op) {
                "+" -> op1 + op2
                "−" -> op1 - op2
                "×" -> op1 * op2
                "÷" -> if (op2 != 0.0) op1 / op2 else Double.NaN
                else -> op2
            }

            tvEquation.text = "${formatNumber(op1)} $op ${formatNumber(op2)} ="
            tvDisplay.text = if (result.isNaN()) "Error" else formatNumber(result)
            currentInput.clear().append(if (result.isNaN()) "" else formatNumber(result))
            operand1 = null
            pendingOperation = null
            isNewOperation = true
        }
    }

    private fun formatNumber(number: Double): String {
        return if (number == number.toLong().toDouble()) {
            number.toLong().toString()
        } else {
            DecimalFormat("#.######").format(number)
        }
    }
}
