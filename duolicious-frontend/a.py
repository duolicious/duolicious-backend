#!/usr/bin/env python3

def g(x, rateOfIncrease=0.25):
    return (x / (x + 10)) ** (1 - rateOfIncrease)

def f(averageAgreementFraction, numAgreements, numDisagreements, numQuestions):
    print(f"""
f(averageAgreementFraction={averageAgreementFraction}, numAgreements={numAgreements}, numDisagreements={numDisagreements}, numQuestions={numQuestions}) = 
""".strip())

    numAnswers = numAgreements + numDisagreements
    agreementFraction = 0.0 if numAnswers == 0 else numAgreements / numAnswers

    w = g(numAnswers) / g(numQuestions)

    return (
        averageAgreementFraction * (1 - w) +
        agreementFraction * w
    )


print(f(0.7, 10, 0, 2000) * 100.0)
print()

print(f(0.7, 50, 0, 2000) * 100.0)
print()

print(f(0.7, 100, 0, 2000) * 100.0)
print()

print(f(0.7, 200, 0, 2000) * 100.0)
print()

print(f(0.7, 500, 0, 2000) * 100.0)
print()

print(f(0.7, 1000, 0, 2000) * 100.0)
print()

print(f(0.7, 0, 0, 2000) * 100.0)
print()

print(f(0.7, 95, 5, 2000) * 100.0)
print()
