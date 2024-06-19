import unittest
from verification import (
    get_messages,
    process_response,
    get_system_content,
)

estimated_age = 42

success_content_template = """
{
  "image_1_was_not_edited": 1.0,
  "image_1_is_photograph": 1.0,
  "image_1_has_at_least_one_person": 1.0,
  "image_1_has_exactly_one_person": 1.0,
  "image_1_has_45_degree_angle": 1.0,
  "image_1_has_claimed_gender": 1.0,
  "image_1_has_claimed_age": 1.0,
  "image_1_has_claimed_minimum_age": 1.0,
  "image_1_has_claimed_ethnicity": 1.0,
  "image_1_has_smiling_person": 1.0,
  "image_1_has_eyebrow_touch": 1.0,
  "image_1_has_downward_thumb": 1.0,
  "image_1_has_person_from_image_2": 1.0,
  "image_1_has_person_from_image_3": 1.0
}
"""

success_content_1 = success_content_template

success_content_2 = success_content_template.replace(
    '"image_1_has_claimed_ethnicity": 1.0',
    '"image_1_has_claimed_ethnicity": null')

success_content_3 = success_content_template.replace(
    '"image_1_has_person_from_image_2": 1.0',
    '"image_1_has_person_from_image_2": 0.0').replace(
    '"image_1_has_person_from_image_3": 1.0',
    '"image_1_has_person_from_image_3": 0.0')

failure_content_1 = success_content_template.replace(
    '"image_1_is_photograph": 1.0',
    '"image_1_is_photograph": 0.0')

failure_content_2 = success_content_template.replace(
    '"image_1_was_not_edited": 1.0',
    '"image_1_was_not_edited": 0.0')

failure_content_3 = success_content_template.replace(
    '"image_1_has_at_least_one_person": 1.0',
    '"image_1_has_at_least_one_person": 0.0')

failure_content_4 = success_content_template.replace(
    '"image_1_has_exactly_one_person": 1.0',
    '"image_1_has_exactly_one_person": 0.0')

failure_content_5 = success_content_template.replace(
    '"image_1_has_claimed_gender": 1.0',
    '"image_1_has_claimed_gender": 0.0')

failure_content_6 = success_content_template.replace(
    '"image_1_has_claimed_age": 1.0',
    '"image_1_has_claimed_age": 0.0')

failure_content_7 = success_content_template.replace(
    '"image_1_has_claimed_ethnicity": 1.0',
    '"image_1_has_claimed_ethnicity": 0.0')

failure_content_8 = success_content_template.replace(
    '"image_1_has_smiling_person": 1.0',
    '"image_1_has_smiling_person": 0.0')

failure_content_9 = success_content_template.replace(
    '"image_1_has_eyebrow_touch": 1.0',
    '"image_1_has_eyebrow_touch": 0.0')

failure_content_10 = success_content_template.replace(
    '"image_1_has_downward_thumb": 1.0',
    '"image_1_has_downward_thumb": 0.0')

failure_content_11 = success_content_template.replace(
    '"image_1_has_person_from_image_2": 1.0',
    '"image_1_has_person_from_image_2": 0.0')

class TestProcessResponse(unittest.TestCase):
    def test_success_1(self):
        response = success_content_1

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNone(processed.failure)
        self.assertIsNotNone(processed.success)

        self.assertTrue(processed.success.is_verified_age)
        self.assertTrue(processed.success.is_verified_gender)
        self.assertTrue(processed.success.is_verified_ethnicity)

        self.assertEqual(processed.success.verified_uuids, ['u2', 'u3'])
        self.assertEqual(processed.success.raw_json, response)

    def test_success_2(self):
        response = success_content_2

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNone(processed.failure)
        self.assertIsNotNone(processed.success)

        self.assertTrue(processed.success.is_verified_age)
        self.assertTrue(processed.success.is_verified_gender)
        self.assertFalse(processed.success.is_verified_ethnicity)

        self.assertEqual(processed.success.verified_uuids, ['u2', 'u3'])
        self.assertEqual(processed.success.raw_json, response)

    def test_success_3(self):
        response = success_content_3

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNone(processed.failure)
        self.assertIsNotNone(processed.success)

        self.assertTrue(processed.success.is_verified_age)
        self.assertTrue(processed.success.is_verified_gender)
        self.assertTrue(processed.success.is_verified_ethnicity)

        self.assertEqual(processed.success.verified_uuids, [])
        self.assertEqual(processed.success.raw_json, response)

    def test_failure_1(self):
        response = failure_content_1

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks your image isn’t a real photo.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_2(self):
        response = failure_content_2

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks your image might have been edited.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_3(self):
        response = failure_content_3

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks your photo doesn’t have a person in it.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_4(self):
        response = failure_content_4

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks there’s more than one person in your photo.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_5(self):
        response = failure_content_5

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI couldn’t verify your gender.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_6(self):
        response = failure_content_6

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI couldn’t verify your age.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_7(self):
        response = failure_content_7

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI couldn’t verify your ethnicity.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_8(self):
        response = failure_content_8

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks you’re not smiling.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_9(self):
        response = failure_content_9

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks you’re not touching your eyebrow.")
        self.assertEqual(processed.failure.raw_json, response)

    def test_failure_10(self):
        response = failure_content_10

        processed = process_response(response, claimed_uuids=['u2', 'u3'])

        self.assertIsNotNone(processed.failure)
        self.assertIsNone(processed.success)

        self.assertEqual(processed.failure.reason,
            "Our AI thinks you’re not giving the thumbs down.")
        self.assertEqual(processed.failure.raw_json, response)


class TestGetMessages(unittest.TestCase):
    def test_get_messages_null_ethnicity(self):
        self.maxDiff = 99999

        messages = get_messages(
            proof_uuid='u1',
            claimed_uuids=[],
            claimed_age=42,
            claimed_gender='Male',
            claimed_ethnicity=None,
        )

        self.assertEqual(
            messages,
            [
                {
                    "role": "system",
                    "content": """
You have been given one or more image(s) by a user attempting to verify their identity on a social media website. The user claims to be in Image #1. To verify that claim, you must verify these ones:

* Image #1 was not edited.
* Image #1 is a photograph.
* Image #1 contains at least one person.
* Image #1 contains exactly one person.
* Image #1 was photographed at about a 45 degree angle to the side of the person's face (i.e. a three-quarter profile).
* Image #1 contains a person whose gender is: Male. (Users can choose from the options: Man, Woman, Agender, Intersex, Non-binary, Transgender, Trans woman, Trans man, and Other.)
* Image #1 contains a person whose age is: 42.
* Image #1 contains a person whose age is 18 or older.
* Image #1 contains a person who is smiling.
* Image #1 contains a person who is touching their eyebrow.
* Image #1 contains a person who is pointing their thumb downward (not upward).

Provide a JSON object in the following format which assigns a probability from 0.0 to 1.0 to each claim above:

```
{
  image_1_was_not_edited: number
  image_1_is_photograph: number
  image_1_has_at_least_one_person: number
  image_1_has_exactly_one_person: number
  image_1_has_45_degree_angle: number
  image_1_has_claimed_gender: number
  image_1_has_claimed_age: number
  image_1_has_claimed_minimum_age: number
  image_1_has_smiling_person: number
  image_1_has_eyebrow_touch: number
  image_1_has_downward_thumb: number
}
```
""".strip()
                },
                {
                    "role": "user",
                    "content": [
                        {
                          "type": "text",
                          "text": "Image #1:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": 'https://user-images.duolicious.app/450-u1.jpg',
                                "detail": "low"
                            }
                        },
                    ]
                },
            ]
        )

    def test_get_messages(self):
        self.maxDiff = 99999

        messages = get_messages(
            proof_uuid='u1',
            claimed_uuids=['u2', 'u3'],
            claimed_age=42,
            claimed_gender='Male',
            claimed_ethnicity='White',
        )

        self.assertEqual(
            messages,
            [
                {
                    "role": "system",
                    "content": """
You have been given one or more image(s) by a user attempting to verify their identity on a social media website. The user claims to be in Image #1. To verify that claim, you must verify these ones:

* Image #1 was not edited.
* Image #1 is a photograph.
* Image #1 contains at least one person.
* Image #1 contains exactly one person.
* Image #1 was photographed at about a 45 degree angle to the side of the person's face (i.e. a three-quarter profile).
* Image #1 contains a person whose gender is: Male. (Users can choose from the options: Man, Woman, Agender, Intersex, Non-binary, Transgender, Trans woman, Trans man, and Other.)
* Image #1 contains a person whose age is: 42.
* Image #1 contains a person whose age is 18 or older.
* Image #1 contains a person whose primary or only ethnicity is: White. (Users can choose from the options: Black/African Descent, East Asian, Hispanic/Latino, Middle Eastern, Native American, Pacific Islander, South Asian, Southeast Asian, White/Caucasian, and Other.)
* Image #1 contains a person who is smiling.
* Image #1 contains a person who is touching their eyebrow.
* Image #1 contains a person who is pointing their thumb downward (not upward).
* Image #1 contains a person who is in Image #2.
* Image #1 contains a person who is in Image #3.

Provide a JSON object in the following format which assigns a probability from 0.0 to 1.0 to each claim above:

```
{
  image_1_was_not_edited: number
  image_1_is_photograph: number
  image_1_has_at_least_one_person: number
  image_1_has_exactly_one_person: number
  image_1_has_45_degree_angle: number
  image_1_has_claimed_gender: number
  image_1_has_claimed_age: number
  image_1_has_claimed_minimum_age: number
  image_1_has_claimed_ethnicity: number
  image_1_has_smiling_person: number
  image_1_has_eyebrow_touch: number
  image_1_has_downward_thumb: number
  image_1_has_person_from_image_2: number
  image_1_has_person_from_image_3: number
}
```
""".strip()
                },
                {
                    "role": "user",
                    "content": [
                        {
                          "type": "text",
                          "text": "Image #1:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": 'https://user-images.duolicious.app/450-u1.jpg',
                                "detail": "low"
                            }
                        },
                        {
                          "type": "text",
                          "text": "Image #2:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f'https://user-images.duolicious.app/450-u2.jpg',
                                "detail": "low"
                            }
                        },
                        {
                          "type": "text",
                          "text": "Image #3:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": 'https://user-images.duolicious.app/450-u3.jpg',
                                "detail": "low"
                            }
                        },
                    ]
                },
            ]
        )

class TestGetSystemContent(unittest.TestCase):
    def test_get_system_content_with_ethnicity(self):
        self.maxDiff = 99999

        system_content = get_system_content(
            num_claimed_uuids=3,
            claimed_age=42,
            claimed_gender='Female',
            claimed_ethnicity='Black',
        )

        self.assertEqual(
            system_content,
            """
You have been given one or more image(s) by a user attempting to verify their identity on a social media website. The user claims to be in Image #1. To verify that claim, you must verify these ones:

* Image #1 was not edited.
* Image #1 is a photograph.
* Image #1 contains at least one person.
* Image #1 contains exactly one person.
* Image #1 was photographed at about a 45 degree angle to the side of the person's face (i.e. a three-quarter profile).
* Image #1 contains a person whose gender is: Female. (Users can choose from the options: Man, Woman, Agender, Intersex, Non-binary, Transgender, Trans woman, Trans man, and Other.)
* Image #1 contains a person whose age is: 42.
* Image #1 contains a person whose age is 18 or older.
* Image #1 contains a person whose primary or only ethnicity is: Black. (Users can choose from the options: Black/African Descent, East Asian, Hispanic/Latino, Middle Eastern, Native American, Pacific Islander, South Asian, Southeast Asian, White/Caucasian, and Other.)
* Image #1 contains a person who is smiling.
* Image #1 contains a person who is touching their eyebrow.
* Image #1 contains a person who is pointing their thumb downward (not upward).
* Image #1 contains a person who is in Image #2.
* Image #1 contains a person who is in Image #3.
* Image #1 contains a person who is in Image #4.

Provide a JSON object in the following format which assigns a probability from 0.0 to 1.0 to each claim above:

```
{
  image_1_was_not_edited: number
  image_1_is_photograph: number
  image_1_has_at_least_one_person: number
  image_1_has_exactly_one_person: number
  image_1_has_45_degree_angle: number
  image_1_has_claimed_gender: number
  image_1_has_claimed_age: number
  image_1_has_claimed_minimum_age: number
  image_1_has_claimed_ethnicity: number
  image_1_has_smiling_person: number
  image_1_has_eyebrow_touch: number
  image_1_has_downward_thumb: number
  image_1_has_person_from_image_2: number
  image_1_has_person_from_image_3: number
  image_1_has_person_from_image_4: number
}
```
""".strip()
        )

    def test_get_system_content_without_ethnicity(self):
        self.maxDiff = 99999

        system_content = get_system_content(
            num_claimed_uuids=3,
            claimed_age=42,
            claimed_gender='Female',
            claimed_ethnicity=None,
        )

        self.assertEqual(
            system_content,
            """
You have been given one or more image(s) by a user attempting to verify their identity on a social media website. The user claims to be in Image #1. To verify that claim, you must verify these ones:

* Image #1 was not edited.
* Image #1 is a photograph.
* Image #1 contains at least one person.
* Image #1 contains exactly one person.
* Image #1 was photographed at about a 45 degree angle to the side of the person's face (i.e. a three-quarter profile).
* Image #1 contains a person whose gender is: Female. (Users can choose from the options: Man, Woman, Agender, Intersex, Non-binary, Transgender, Trans woman, Trans man, and Other.)
* Image #1 contains a person whose age is: 42.
* Image #1 contains a person whose age is 18 or older.
* Image #1 contains a person who is smiling.
* Image #1 contains a person who is touching their eyebrow.
* Image #1 contains a person who is pointing their thumb downward (not upward).
* Image #1 contains a person who is in Image #2.
* Image #1 contains a person who is in Image #3.
* Image #1 contains a person who is in Image #4.

Provide a JSON object in the following format which assigns a probability from 0.0 to 1.0 to each claim above:

```
{
  image_1_was_not_edited: number
  image_1_is_photograph: number
  image_1_has_at_least_one_person: number
  image_1_has_exactly_one_person: number
  image_1_has_45_degree_angle: number
  image_1_has_claimed_gender: number
  image_1_has_claimed_age: number
  image_1_has_claimed_minimum_age: number
  image_1_has_smiling_person: number
  image_1_has_eyebrow_touch: number
  image_1_has_downward_thumb: number
  image_1_has_person_from_image_2: number
  image_1_has_person_from_image_3: number
  image_1_has_person_from_image_4: number
}
```
""".strip()
        )

if __name__ == '__main__':
    unittest.main()
