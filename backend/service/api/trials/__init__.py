def sent_messages_in_chats(person_id: int) -> bool:
    return 390250 <= person_id < 391550 and person_id % 2 == 0


def club_card_by_distance(person_id: int) -> bool:
    return person_id >= 395000 and person_id % 2 == 0
